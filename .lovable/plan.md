## Diagnóstico

Validei o token permanente direto na Meta Graph API. Resultado:

**✅ Token está correto e permanente**
- Tipo: `SYSTEM_USER`, `expires_at: 0` (não expira)
- App: `gasfacil` (App ID `1466286284853004`)
- Scopes: `whatsapp_business_management`, `whatsapp_business_messaging`
- System User: `Gasfacilpro Bot` (ID `122112472941073551`)

**❌ Os IDs salvos no banco NÃO funcionam com este token**

A linha em `integracoes_whatsapp` da unidade Central Gás tem:
- `meta_phone_number_id = 1068574169676609`
- `meta_waba_id = 1738917314133461`
- `instance_id = 1006245305913016` (não bate com nada — provavelmente App ID antigo)

Ao chamar `GET /1068574169676609` e `POST /1068574169676609/messages` com o token novo, a Meta responde:

```
"Object with ID '1068574169676609' does not exist, 
cannot be loaded due to missing permissions"
```

Mesmo erro para a WABA `1738917314133461`. Ou seja: **o WhatsApp NÃO vai funcionar até corrigir esses IDs e/ou a assinatura da WABA pelo app gasfacil**.

**Outro item desatualizado na memória:** Meta Business ID na memória (`898649429546834`) ≠ o que aparece na URL do screenshot (`931318668260512`). O atual é `931318668260512` (Portfólio "Central Gás").

## Causas prováveis

1. O Phone Number ID e WABA ID foram regerados quando o número foi migrado/recadastrado para o app `gasfacil`, e o banco continua com os IDs antigos.
2. A WABA "Central Gás" pode não estar **subscrita** ao app `gasfacil` (`POST /{waba_id}/subscribed_apps`) — isso é exigido independentemente do System User ter Controle Total.

## Plano de ação

### 1. Coletar os IDs corretos (precisa de você)
No Meta Business Suite, abrir **WhatsApp Manager → Visão geral**, clicar no número **(43) 3524-1094** e copiar:
- **Phone Number ID** (não é o número do telefone)
- **WhatsApp Business Account ID (WABA)**

E o mesmo para o número da Central GasCP, se for usar.

Alternativa: posso criar uma edge function `meta-discover-numbers` que, recebendo o Business ID `931318668260512`, tenta listar WABAs e telefones via Graph API (precisa do scope `business_management` — se não tiver, voltamos ao passo manual).

### 2. Atualizar o banco
Migration para a unidade `aa5b7c93-4fe6-4dba-a0b5-2af43cd20614`:
- `meta_phone_number_id` = ID novo
- `meta_waba_id` = ID novo
- `meta_access_token` = token permanente (`EAAU1lG…ZBhGVaCwZDZD`)
- `instance_id` = `1466286284853004` (App ID gasfacil) ou apenas limpo
- `status_conexao` = `conectado`

E também atualizar o secret `META_WHATSAPP_TOKEN` (usado por algumas edge functions como fallback) com o token permanente.

### 3. Subscrever o app na WABA
Chamar uma vez:
```
POST https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps
Authorization: Bearer {TOKEN_PERMANENTE}
```
Faço isso via uma edge function `meta-subscribe-waba` (one-shot) ou via curl direto após você confirmar os IDs.

### 4. Configurar webhook na WABA
Apontar o webhook da WABA para:
```
https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-webhook
```
com o `verify_token` = valor de `meta_verify_token` da linha (se estiver vazio, gero um).

### 5. Teste end-to-end
- Edge function `meta-diagnostico` deve retornar tudo verde.
- Enviar uma mensagem de teste via `meta-webhook` → `bia-core` para o WhatsApp humano (43) 99966-1816.

### 6. Atualizar memória
- Business ID corrigido: `898649429546834` → `931318668260512`.
- Registrar System User `Gasfacilpro Bot` (ID `122112472941073551`) como dono do token permanente.
- Marcar token como permanente (não mais 24h).

## O que preciso de você agora

Me passe o **Phone Number ID** e o **WABA ID** atuais do número 4335241094 (e do GasCP, se quiser ativar também). Sem esses dois números, o passo 2 não pode ser executado e o WhatsApp continuará desconectado.

Se preferir, te guio passo a passo em prints de onde clicar no WhatsApp Manager.
