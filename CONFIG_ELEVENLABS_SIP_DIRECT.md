# Configuração ElevenLabs SIP Trunk Direto (GoTo → ElevenLabs)

> **Objetivo:** Eliminar Vonage e Twilio do caminho de voz. A chamada vai do
> 0800 GoTo direto para a Bia na ElevenLabs via SIP TLS.

```text
Cliente → 0800 590 0492 (GoTo)
        → SIP Trunk ramal 1004 (TLS)
        → ElevenLabs (Bia)
            ↳ webhook initiation  (variáveis dinâmicas + popup Bina)
            ↳ tools (identificar_cliente / criar_pedido — já existem)
            ↳ webhook post-call   (grava transcript + duração)
```

---

## 1. Pré-requisito GoTo (já feito)

Confirmar que o "Encontre-me/Siga-me" do ramal 1004 está **desligado**.
Detalhes em `CONFIG_GOTO_RAMAL_1004.md` seção 2.

---

## 2. Importar SIP Trunk no painel da ElevenLabs

`https://elevenlabs.io/app/conversational-ai/phone-numbers` → **Import phone number**
→ aba **SIP Trunk** (não Twilio).

| Campo | Valor |
|---|---|
| Label | `Forte Gás 0800 (GoTo)` |
| Phone Number | `+5508005900492` |
| Termination URI | `sip:reg.jiveip.net` |
| Auth Username | `53LcZzueOL72RsONRVMAe6ag0XSlFe` |
| Auth Password | `ZrBAJEsTuX8Bfaut` |
| Transport | **TLS** (fallback: UDP) |
| Codec preferido | PCMU/PCMA (G.711) |

Salvar e **atribuir ao agente "Bia – Forte Gás"**.

> Se o registro falhar, alternar Transport para **UDP** e tentar novamente.
> Verificar no GoTo (Dispositivos → Sip Trunk → Visão geral) se o status
> mudou para 🟢 Disponível e o IP público é da ElevenLabs.

---

## 3. Configurar webhooks no agente

`Agent → Settings → Advanced → Webhooks`

### 3.1 Conversation Initiation (obrigatório)

- **Habilitar** "Fetch initiation client data from webhook"
- URL:
  ```
  https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/elevenlabs-call-initiation
  ```
- Method: `POST`
- Sem secret (a edge function aceita público)

### 3.2 Post-call (recomendado)

- URL:
  ```
  https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/elevenlabs-call-postcall
  ```
- Eventos: `post_call_transcription`

---

## 4. Variáveis dinâmicas disponíveis no prompt

O webhook initiation envia automaticamente para o agente:

| Variável | Conteúdo |
|---|---|
| `{{caller_phone}}` | Telefone real (vazio se caller-id não for confiável) |
| `{{caller_confiavel}}` | `"true"` ou `"false"` |
| `{{called_number}}` | DID chamado (`+5508005900492`) |
| `{{call_sid}}` | ID da conversa ElevenLabs |
| `{{empresa_id}}` | UUID Forte Gás |
| `{{empresa_nome}}` | `"Forte Gas"` |
| `{{unidade_id}}` | UUID da matriz |
| `{{cliente_id}}` | UUID se cliente foi pré-identificado |
| `{{cliente_nome}}` | Nome se cliente conhecido |

> O prompt da Bia **não muda** — as mesmas variáveis usadas hoje no
> `twilio-voice-webhook` continuam funcionando.

---

## 5. Testar

1. Ligar para `0800 590 0492` de um celular pessoal.
2. Acompanhar:
   - **GoTo → Análise de chamadas:** "Atendida pelo dispositivo SIP Trunk"
   - **ElevenLabs → Conversations:** chamada com transcript em tempo real
   - **Lovable Cloud → Edge Functions → `elevenlabs-call-initiation` → Logs:**
     `[EL-INIT] Incoming` e `[EL-INIT] Response`
   - **Lovable Cloud → Edge Functions → `elevenlabs-call-postcall` → Logs:**
     `[EL-POSTCALL] updated: true`
   - **ERP → popup Bina:** chamada aparece para o atendente
3. Conferir após desligar:
   - `chamadas_recebidas` tem `duracao_segundos`, `status='finalizada'` e
     transcript dentro de `observacoes`.

---

## 6. Fallback (mantido por ~7 dias)

`vonage-voice-webhook` e `twilio-voice-webhook` permanecem deployados.
Os números Vonage e Twilio continuam ativos mas **sem encaminhamento ativo**
do GoTo. Se algo falhar no SIP direto:

1. No painel GoTo, reativar o forward do ramal 1004 → Vonage DID.
2. Tudo volta ao fluxo antigo em ~5 min.

---

## 7. Após validação estável

Quando a ligação SIP direta estiver estável por ~7 dias:

1. Cancelar número Vonage (+55 11 5283-5921).
2. Cancelar número Twilio (+1 478-429-7119).
3. Deletar edge functions `vonage-voice-webhook` e `twilio-voice-webhook`.
4. Atualizar `CONFIG_GOTO_0800_FORWARD.md`.

---

## Diagnóstico rápido

| Sintoma | Causa provável |
|---|---|
| ElevenLabs não recebe chamada | SIP Trunk não registrou — alternar TLS↔UDP |
| GoTo mostra "Indisponível" no SIP Trunk | Credenciais/registro — ressincronizar |
| Bia atende mas não fala português ou usa contexto errado | Webhook initiation não está habilitado no agente |
| `chamadas_recebidas` não atualiza após chamada | Webhook post-call não configurado ou URL errada |
| Bia trata operadora como cliente | Lógica `OPERATOR_LAST10` em `elevenlabs-call-initiation/index.ts` precisa do número novo |

---

## ⚙️ Tool `criar_pedido` — Preço negociado (atualizado)

A edge function `elevenlabs-bia-tools` agora aceita **preço negociado livre** na ação `criar_pedido`. Para a Bia usar, atualize **no painel do agente ElevenLabs**:

### Schema do tool `criar_pedido` — adicionar propriedades opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `preco_unitario` | number | Preço final **por unidade** em reais, quando a Bia conceder qualquer desconto fora da tabela padrão (ex.: cliente pediu 120 e a tabela é 125). |
| `desconto_unitario` | number | Alternativa: desconto em R$ por unidade (será subtraído do preço base). |

Travas no servidor: o valor é limitado entre `preco_desconto` da tabela (piso) e `preco` cheio (teto). Se não houver `preco_desconto`, o piso é 50% do preço cheio.

### Instrução para o prompt do agente

> Sempre que você conceder qualquer desconto ou fechar um valor diferente do preço cheio (mesmo o `preco_desconto` da tabela), envie `preco_unitario` no `criar_pedido` com o valor final acordado em reais por unidade. **Não confie só em `usar_desconto`** — ele aplica apenas o preço de desconto fixo da tabela.
