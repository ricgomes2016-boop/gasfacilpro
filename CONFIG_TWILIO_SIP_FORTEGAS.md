# Configuração Twilio Elastic SIP Trunk — Forte Gás

Este guia conecta o **GoTo (ramal 1004)** → **Twilio Elastic SIP Trunk** → **webhook Bia (ElevenLabs)**.

> O webhook `twilio-voice-webhook` já está implantado e identifica a empresa **Forte Gás** automaticamente pelo DID `+554337717463`.
> Este documento cobre **somente a parte que precisa ser feita no console da Twilio e da GoTo**.

---

## 1. Credenciais SIP do GoTo (já salvas como secrets)

| Campo | Valor |
|---|---|
| Ramal | `1004` |
| Login (SIP User) | `53LcZzueOL72RsONRVMAe6ag0XSlFe` |
| Senha | `ZrBAJEsTuX8Bfaut` |
| Domain (Registrar) | `reg.jiveip.net` |
| Outbound Proxy | `fortegascomercioetransporteslt.jive.rtcfront.net` |
| DID externo | `+55 43 3771-7463` |

Salvas como secrets: `GOTO_SIP_USER`, `GOTO_SIP_PASSWORD`, `GOTO_SIP_DOMAIN`, `GOTO_SIP_OUTBOUND_PROXY`, `GOTO_SIP_RAMAL`.

---

## 2. Criar o Elastic SIP Trunk no Twilio

**Twilio Console → Elastic SIP Trunking → Trunks → Create new SIP Trunk**

1. **Friendly name**: `GoTo - Forte Gas`
2. Salvar e abrir o trunk recém-criado.

### 2.1 Termination (chamadas saindo da Twilio para a GoTo) — opcional
> Só preciso configurar se quiser que a Bia faça **ligações de saída**. Para receber chamadas, pule.

- **Termination URI**: `fortegas-bia.pstn.twilio.com` (escolha um nome único)
- **Credential List** → criar nova com o `GOTO_SIP_USER` / `GOTO_SIP_PASSWORD`.

### 2.2 Origination (chamadas entrando da GoTo na Twilio) — **OBRIGATÓRIO**

- **Origination URI**: clique em "Add new" e adicione:
  ```
  sip:fortegascomercioetransporteslt.jive.rtcfront.net
  ```
  - Priority: `10`, Weight: `10`, Enabled: ✅

### 2.3 Authentication (libera o IP da GoTo)
- **IP Access Control Lists** → criar nova → adicionar o IP da GoTo (`fortegascomercioetransporteslt.jive.rtcfront.net` → resolver para o IP atual e colocar a faixa `/32`).
- Ou usar **Credential Lists** se a GoTo enviar SIP Auth.

### 2.4 Numbers
- Associar o número Twilio brasileiro (ou comprar um) ao trunk.
- **Importante**: o DID `+554337717463` é da GoTo; a Twilio precisa ter o **seu próprio número** que receberá as chamadas encaminhadas pela GoTo.

---

## 3. Apontar o Voice URL para o webhook da Bia

Para o número Twilio que receberá as chamadas (vinculado ao trunk):

**Phone Numbers → Manage → Active Numbers → [escolher número] → Voice Configuration**

| Campo | Valor |
|---|---|
| A call comes in | **Webhook** |
| URL | `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/twilio-voice-webhook` |
| HTTP Method | `POST` |
| Primary Handler Fails | (deixe em branco ou repita o mesmo URL) |

Salvar.

---

## 4. Configurar a GoTo para encaminhar o DID para a Twilio

No painel GoTo (Admin → PBX → Dial Plans / Forwarding):

1. Pegue o **Termination URI** do passo 2.1 (ex: `fortegas-bia.pstn.twilio.com`).
2. Configure o ramal `1004` ou diretamente o DID `+554337717463` para encaminhar (call forwarding) via SIP para esse URI.
3. Use as credenciais SIP do trunk Twilio (criadas no Credential List).

---

## 5. Teste

1. Ligue para `+55 43 3771-7463`.
2. Verifique no **Twilio Console → Monitor → Logs → Calls** se a chamada chegou.
3. Verifique nos logs do edge function `twilio-voice-webhook` (Lovable Cloud → Functions → Logs).
4. A Bia deve atender com contexto da Forte Gás (`empresa_nome="Forte Gas"` é passado como dynamic variable).

---

## 6. Variáveis dinâmicas enviadas para o agente ElevenLabs

O webhook envia automaticamente:

- `caller_phone` — número de quem ligou
- `called_number` — DID chamado (`+554337717463`)
- `call_sid` — ID da chamada Twilio
- `empresa_id` — UUID da Forte Gás
- `empresa_nome` — `"Forte Gas"`
- `unidade_id` — UUID da unidade matriz

> No agente ElevenLabs (Conversational AI → Agent Settings → System Prompt), use estas variáveis com `{{empresa_nome}}`, `{{caller_phone}}` etc.

---

## Diagnóstico rápido

| Sintoma | Causa provável |
|---|---|
| Twilio Logs vazio | GoTo não está encaminhando para o trunk → revisar passo 4 |
| Twilio recebeu mas webhook não logou | Voice URL não configurada → passo 3 |
| Webhook logou mas Bia não fala | `ELEVENLABS_AGENT_ID` errado ou agent inativo |
| Chamada cai imediatamente | Codec incompatível — habilitar **PCMU/PCMA** no trunk Twilio |
