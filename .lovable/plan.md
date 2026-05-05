## Importar 0800 na ElevenLabs via SIP Trunk (GoTo como provedor)

### Topologia confirmada (via screenshots GoTo Admin)
```
+55 800 590 0492 ──► Ramal 1004 ──► SIP Trunk dispositivo ──► [ElevenLabs registra aqui]
```
O SIP Trunk do GoTo é inbound-only: não encaminha pra IP externo. Quem se conecta é a ElevenLabs, autenticando no `reg.jiveip.net` com as credenciais do ramal 1004.

### Entregáveis

**1 edge function nova:** `elevenlabs-import-sip-trunk` (administrativa, one-shot)

### O que a edge function faz
1. Lê secrets já existentes:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID`
   - `GOTO_SIP_USER`, `GOTO_SIP_PASSWORD`, `GOTO_SIP_DOMAIN` (`reg.jiveip.net`), `GOTO_SIP_OUTBOUND_PROXY`

2. Chama `POST https://api.elevenlabs.io/v1/convai/phone-numbers/create`:
```json
{
  "provider": "sip_trunk",
  "phone_number": "+5508005900492",
  "label": "Forte Gás 0800 (GoTo Trunk 1004)",
  "transport": "udp",
  "address": "reg.jiveip.net",
  "username": "<GOTO_SIP_USER>",
  "password": "<GOTO_SIP_PASSWORD>",
  "agent_id": "<ELEVENLABS_AGENT_ID>"
}
```

3. Retorna em **200 OK** (padrão do projeto):
   - **Sucesso:** `{ ok: true, phone_number_id, sip_status }`
   - **Falha API:** `{ ok: false, error: "<mensagem da ElevenLabs>", http_status }` — sem 500

### Segurança
- Sem JWT (one-shot administrativa)
- Header opcional `x-admin-secret` validado contra `ELEVENLABS_WEBHOOK_SECRET`
- CORS habilitado padrão do projeto

### Como executar
Após deploy automático, eu mesmo disparo via `curl_edge_functions` e te mostro a resposta. Você não precisa clicar em nada.

### Não-objetivos (não vou mexer)
- `App.tsx`, providers, rotas — intocados
- Banco de dados — sem alterações (número fica armazenado na ElevenLabs)
- `supabase/config.toml` — sem mudanças
- Nenhuma UI nova
- Nenhuma alteração nas edge functions existentes (`elevenlabs-call-initiation`, `elevenlabs-call-postcall`, `elevenlabs-conversation-token`)

### Plano B se a API rejeitar
A função retorna a mensagem exata de erro. Aí caímos pro caminho manual no painel ElevenLabs (Conversational AI → Phone Numbers → Import → SIP Trunk) — eu te dou os valores exatos pra colar.

### Passo após sucesso
Você liga do celular pro **0800 590 0492**. A Bia deve atender em ~2-3 segundos. Eu acompanho em tempo real:
- `elevenlabs-call-initiation` (chegada da chamada)
- `elevenlabs-call-postcall` (transcript salvo no banco)

Se não atender, leio os logs da ElevenLabs Call History via API e diagnostico (geralmente: `address` errado, transport TCP vs UDP, ou whitelist de IP no GoTo).

### Checklist final
- [x] Topologia GoTo mapeada e confirmada
- [x] Secrets necessários existem (`GOTO_SIP_*`, `ELEVENLABS_*`)
- [x] Agente Bia já criado na ElevenLabs (`ELEVENLABS_AGENT_ID` setado)
- [x] Webhooks `call-initiation` e `call-postcall` já existem
- [ ] Aprovar este plano → eu crio a função, deploy, executo, te mostro resultado
