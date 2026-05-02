## Diagnóstico

A ligação chegou no Vonage, executou o `talk` ("Conectando você à Bia") e em seguida o leg SIP para a Vapi falhou com `SIP 480 Unavailable`.

Causa: números na Vapi com `provider: "vapi"` + `sipUri` **exigem** bloco `authentication` (username/password). Sem credenciais corretas no INVITE, a Vapi rejeita.

Já apliquei na Vapi (via API privada validada):
- `phoneNumber 24375496…` agora tem `authentication.username = vonage_fortegas_inbound_001` + uma senha nova segura.

Falta configurar o lado Vonage (nosso webhook) para enviar essas credenciais.

## Mudanças

1. **Adicionar 2 secrets** no projeto (via formulário seguro):
   - `VAPI_SIP_USERNAME` = `vonage_fortegas_inbound_001`
   - `VAPI_SIP_PASSWORD` = `VonFG_87dce0cb530bcc834c9616ede872a4d4`

   O webhook `vonage-voice-webhook` já lê esses secrets e injeta `username`/`password` no endpoint SIP do NCCO automaticamente.

2. **Redeploy** da função `vonage-voice-webhook` para garantir que pegue os novos env vars.

3. **Teste**: ligar para `+55 11 5283-5921`. Esperado:
   - Áudio "Conectando você à Bia, um momento."
   - SIP leg responde 200 OK.
   - Bia atende e conversa.

4. **Atualizar memória** `mem://integrations/vonage-vapi-sip` com as credenciais ativas (apenas username, não senha).

## Validação pós-deploy

- Conferir log `[VONAGE-EVENT-DIAG]` — leg outbound SIP deve mostrar `status: answered, sip_code: 200` em vez de `480`.
- Conferir `GET /call` na Vapi — última call deve ter `endedReason: customer-ended-call` ou similar (não mais `403-forbidden`/`480`).
