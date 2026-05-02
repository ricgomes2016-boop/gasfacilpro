# Encaminhamento 0800 GoTo → Vonage → Bia

## Fluxo

```
Cliente real (xx) xxxxx-xxxx
        │
        ▼
0800 590 0492  (GoTo)
        │ encaminhamento PSTN
        ▼
+55 11 5283-5921  (Vonage DID)
        │ webhook: vonage-voice-webhook
        ▼
Twilio (DID Bia) → ElevenLabs (Bia)
        │ ferramentas
        ▼
elevenlabs-bia-tools  (identificar_cliente / criar_pedido)
```

## Comportamento de caller-id

Quando a GoTo encaminha por PSTN, o caller-id que chega na Vonage normalmente
**não é** o número real do cliente — costuma ser o próprio DID Vonage
(`551152835921`) ou o número do 0800 (`08005900492`).

Para evitar que a Bia confunda a operadora com um cliente cadastrado, o
sistema agora classifica o caller-id em três etapas:

1. **`vonage-voice-webhook`** lê `from`, `to` e cabeçalhos SIP repassados
   (`Diversion`, `P-Asserted-Identity`, `Remote-Party-ID`, `SipHeader_*`).
   - Se algum desses cabeçalhos trouxer um número que **não** é de operadora,
     usa esse como `caller_real` e marca como confiável.
   - Caso contrário, marca como **não confiável** e propaga para o Twilio
     com `from = "0000000000"` (sentinel).
   - Log: `[VONAGE-CALLER-ID] { incomingFrom, sipHeaderCandidates, callerReal, callerConfiavel }`.

2. **`twilio-voice-webhook`** detecta o sentinel/operadora e:
   - **Não busca cliente** pelo telefone.
   - Salva `chamadas_recebidas.telefone = NULL` com observação
     `"Encaminhada via 0800/operadora..."` para não disparar popup de cliente
     conhecido errado.
   - Repassa para o agente da ElevenLabs as variáveis dinâmicas:
     - `caller_phone` = `""` (vazio quando não confiável)
     - `caller_confiavel` = `"false"`

3. **`elevenlabs-bia-tools` → `identificar_cliente`** aceita o campo
   `caller_id_confiavel` (e/ou `caller_confiavel`). Quando `false` ou quando
   o telefone recebido bate com a lista de operadoras, retorna:
   ```json
   {
     "encontrado": false,
     "motivo": "caller_id_operadora",
     "mensagem": "A chamada veio de encaminhamento... peça verbalmente nome, telefone com DDD e endereço."
   }
   ```
   A Bia então pede o telefone real e chama `identificar_cliente` de novo
   com o número informado pelo cliente.

## Lista de números considerados "operadora"

(últimos 10 dígitos)

- `1152835921` — Vonage DID Central Gás
- `8005900492` — GoTo 0800 590 0492
- `5900492`    — variantes parciais

Para adicionar outros DIDs/0800, editar `OPERATOR_LAST10` em:
- `supabase/functions/vonage-voice-webhook/index.ts`
- `supabase/functions/twilio-voice-webhook/index.ts`
- `supabase/functions/elevenlabs-bia-tools/index.ts`

## Prompt da Bia (configurar na ElevenLabs)

A primeira tool call deve ser:

```
identificar_cliente(telefone={{caller_phone}}, caller_id_confiavel={{caller_confiavel}})
```

Se a resposta vier `motivo: "caller_id_operadora"` ou `encontrado: false`,
a Bia diz:

> "Para registrar seu pedido, qual é o seu telefone com DDD e o endereço
> completo (rua, número e bairro)?"

E em seguida chama `identificar_cliente` novamente com o telefone informado.

## Validação

1. Ligar do celular pessoal para **0800 590 0492**.
2. Conferir log `[VONAGE-CALLER-ID]` em `vonage-voice-webhook` —
   `callerConfiavel` provavelmente será `false` se a GoTo não encaminhar
   o caller-id original via SIP header.
3. A Bia deve atender com "Conectando você a Central Gás, um momento." e
   logo pedir o telefone + endereço, **sem** assumir que é cliente conhecido.
4. Conferir `chamadas_recebidas`: registro com `telefone = NULL` e
   observação indicando "Encaminhada via 0800/operadora".
5. Após o cliente informar o telefone real, a Bia encontra o cadastro
   (se existir) e segue o fluxo normal.

## Para "ativar" o caller-id real

Se quisermos receber o número original do cliente, é preciso pedir à GoTo
para encaminhar via **SIP trunking** (não PSTN puro) e configurar o
encaminhamento para preservar `From` ou enviar `Diversion` /
`P-Asserted-Identity`. Aí o `vonage-voice-webhook` extrairá automaticamente
e marcará `callerConfiavel = true`.
