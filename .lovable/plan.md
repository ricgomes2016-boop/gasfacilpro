# Configurar Vapi automaticamente via API

## Por que isso resolve

Você já configurou `VAPI_API_KEY` como secret no Lovable Cloud, e os secrets `GOTO_SIP_USERNAME / PASSWORD / DOMAIN / OUTBOUND_PROXY` já estão lá da etapa anterior. Com isso eu consigo fazer **tudo via API** sem você precisar achar campos escondidos no painel da Vapi (incluindo o famoso "Server URL" que sumiu da nova UI).

## O que vou fazer

### 1. Criar edge function temporária `vapi-setup`

Uma função one-shot que, ao ser chamada uma vez, executa 4 passos contra a API da Vapi (`https://api.vapi.ai`) usando `Authorization: Bearer ${VAPI_API_KEY}`:

**Passo A — Criar/atualizar SIP Trunk Credential**
```
POST /credential
{
  "provider": "byo-sip-trunk",
  "name": "GoTo Forte Gas - Ramal 1004",
  "gateways": [{
    "ip": "fortegascomercioetransporteslt.jive.rtcfront.net",
    "port": 5060,
    "netmask": 32,
    "inboundEnabled": true,
    "outboundEnabled": true,
    "outboundProtocol": "tls/srtp"
  }],
  "outboundAuthenticationPlan": {
    "authUsername": "53LcZzueOL72RsONRVMAe6ag0XSlFe",
    "authPassword": "ZrBAJEsTuX8Bfaut",
    "sipRegisterPlan": {
      "domain": "reg.jiveip.net",
      "username": "53LcZzueOL72RsONRVMAe6ag0XSlFe",
      "realm": "reg.jiveip.net"
    }
  }
}
```
Retorna `credentialId`.

**Passo B — Listar assistentes**
```
GET /assistant
```
Identifica o assistente "Bia – Forte Gás" (ou pega o primeiro se só houver um) → `assistantId`.

**Passo C — Atualizar `serverUrl` do assistente**
```
PATCH /assistant/{assistantId}
{
  "server": {
    "url": "https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vapi-webhook"
  }
}
```
Garante que toda chamada inbound vá pro nosso webhook (que já está pronto e roteia `consultar_preco` / `criar_pedido`).

**Passo D — Importar/atualizar número 0800**
```
POST /phone-number
{
  "provider": "byo-phone-number",
  "name": "Forte Gas 0800",
  "number": "+558005900492",
  "numberE164CheckEnabled": false,
  "credentialId": "<id do passo A>",
  "assistantId": "<id do passo B>"
}
```
Se já existir, faz `PATCH` em vez de `POST` (a função detecta listando `GET /phone-number` antes).

### 2. Você só dispara a função 1 vez

Eu deixo um botão simples (ou só o curl pronto) pra você acionar. A função:
- Retorna JSON com `credentialId`, `assistantId`, `phoneNumberId` e o status de cada passo (✅/❌)
- Loga tudo no Edge Functions pra eu debugar se algo falhar

### 3. Depois disso, você só faz 2 coisas (fora da Vapi)

1. **Desligar o forward "Encontre-me/Siga-me"** no GoTo (Pessoas → usuário do ramal 1004) — sem isso a chamada continua indo pro celular `+5543999661816` antes de chegar na Vapi.
2. **Ressincronizar o dispositivo SIP Trunk** no GoTo Admin → status muda de 🔴 Indisponível → 🟢 Disponível em ~2 min.

### 4. Teste fim-a-fim

Liga pra `0800 590 0492`. Eu acompanho os logs de `vapi-webhook` em tempo real e te confirmo se as tools `consultar_preco`/`criar_pedido` foram chamadas.

## Plano B (se a API da Vapi recusar algum campo)

Se o endpoint `/credential` da Vapi tiver mudado (acontece — é beta), a função retorna o erro exato da Vapi e eu ajusto o payload. Não precisa você mexer em nada.

## Arquivos que vou criar/editar

- `supabase/functions/vapi-setup/index.ts` — função temporária (deletada depois que funcionar)
- `CONFIG_GOTO_RAMAL_1004.md` — adicionar IDs retornados pela Vapi pra referência

## Nada muda no resto do código

`vapi-webhook` e `twilio-voice-webhook` continuam intactos.
