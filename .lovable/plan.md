## Cenário

```
Cliente real (xx) xxxxx-xxxx
        │
        ▼
0800 590 0492 (GoTo)
        │ encaminha via PSTN
        ▼
+55 11 5283-5921 (Vonage DID)
        │ webhook vonage-voice-webhook
        ▼
Twilio → Vapi → ElevenLabs (Bia)
        │ ferramentas
        ▼
elevenlabs-bia-tools (identificar_cliente / criar_pedido)
```

Quando a GoTo encaminha por PSTN, o `from` que chega na Vonage normalmente é **o número do 0800/GoTo** (ou o próprio DID 5283-5921), **não** o número real do cliente. Hoje o sistema usa esse `from` como se fosse o telefone do cliente — o que causaria falsos "match" com a própria empresa e poluição na tabela `chamadas_recebidas`.

## Objetivo

A Bia deve **sempre pedir telefone e endereço** quando a chamada vier do encaminhamento do 0800 da GoTo, ignorando o caller ID herdado da operadora. Caso a GoTo (ou outra operadora) envie o número real do cliente via cabeçalho SIP, aproveitar.

## Mudanças

### 1. `supabase/functions/vonage-voice-webhook/index.ts`

- Capturar `from`, `to` e cabeçalhos SIP que a Vonage repassa (`SipHeader_*`, `Diversion`, `P-Asserted-Identity`, `Remote-Party-ID`) tanto na query string quanto no body do evento.
- Normalizar e classificar o caller ID:
  - Se `from` ∈ lista de "números de operadora" (DID Vonage `551152835921`, número do 0800 GoTo `08005900492` e variantes com/sem +55, com/sem 0), marcar como `caller_id_confiavel = false`.
  - Se houver número real em `Diversion` / `P-Asserted-Identity` / `Remote-Party-ID`, usar esse como `caller_real` e marcar `caller_id_confiavel = true`.
- Logar `[VONAGE-CALLER-ID] { from, to, caller_real, confiavel }` para diagnóstico.
- Passar essa informação adiante via parâmetro de URL no `connect` para o Twilio (`?caller_real=...&caller_confiavel=0|1`) — assim o webhook do Twilio repassa para o Vapi/ElevenLabs como variável dinâmica.
- Manter a saudação "Conectando você a Central Gás, um momento.".

### 2. `supabase/functions/elevenlabs-bia-tools/index.ts` — `identificar_cliente`

- Aceitar novo campo opcional `caller_id_confiavel` (boolean) no body.
- Manter lista interna `OPERATOR_NUMBERS = ["551152835921", "08005900492", "5511..."]` (números de DIDs/0800 conhecidos). Se `telefone` recebido bater nessa lista **ou** `caller_id_confiavel === false`, **não** tentar buscar cliente pelo telefone:
  - Retornar `{ encontrado: false, motivo: "caller_id_operadora", mensagem: "Chamada veio de encaminhamento. Peça nome, telefone para confirmação e endereço." }`.
  - Ainda registrar a chamada em `chamadas_recebidas` com `telefone = null` (ou o número da operadora marcado como tal em `observacoes: "Encaminhada via 0800 GoTo"`), evitando popup falso de "cliente conhecido".
- Quando `caller_id_confiavel === true` e o telefone é válido, mantém o comportamento atual (busca por sufixo de 10/11 dígitos).

### 3. Prompt da Bia (ElevenLabs)

Atualizar a instrução do agente (configuração na ElevenLabs, fora do código) para:
- Sempre **chamar `identificar_cliente` primeiro** com o telefone que recebeu via variável dinâmica `caller_real`.
- Se a resposta vier `motivo: "caller_id_operadora"` ou `encontrado: false`, **pedir verbalmente**: "Para registrar seu pedido, qual é o seu telefone com DDD e o endereço completo (rua, número e bairro)?"
- Depois disso, chamar `identificar_cliente` de novo com o telefone informado pelo cliente; se ainda não encontrar, seguir como cliente novo.

### 4. Documentação

Atualizar `CONFIG_GOTO_RAMAL_1004.md` (ou criar `CONFIG_GOTO_0800_FORWARD.md`) descrevendo:
- O 0800 da GoTo aponta para 5283-5921 (Vonage).
- A Bia trata caller ID herdado como não confiável e sempre pede telefone real.
- Como verificar nos logs (`[VONAGE-CALLER-ID]`) se a GoTo está enviando o número real via cabeçalho SIP.

## Validação

1. Ligar do celular pessoal para **0800 590 0492** → confirmar nos logs do `vonage-voice-webhook` qual `from` chegou (esperado: número da GoTo/DID, não o celular).
2. Confirmar que a Bia atende com "Conectando você a Central Gás, um momento." e em seguida pede telefone + endereço, **sem** assumir que já é cliente.
3. Conferir `chamadas_recebidas`: o registro deve ter `observacoes` indicando "Encaminhada via 0800 GoTo" e **não** disparar popup de cliente conhecido para o número da operadora.
4. Após o cliente informar o telefone real, a Bia deve achar o cadastro (se existir) e prosseguir normalmente.
