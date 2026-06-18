
## Diagnóstico

Coletei evidências do banco e dos logs:

**WhatsApp (Meta — unidade Central Gás)**
- 14 mensagens de clientes chegaram nas últimas 36h (last: 17/06 21:26).
- Ontem (16/06) a Bia respondia normalmente (vejo `role:assistant` no `ai_mensagens`).
- **Hoje (17/06) NENHUMA mensagem `role:assistant` foi gerada** — apenas `role:user` entrando. A Bia parou de responder a partir de hoje.

**Telefone (Twilio +55 43 2398-0020)**
- Última chamada registrada em `chamadas_recebidas` foi **09/06** (9 dias atrás).
- Nenhum hit recente no `twilio-voice-webhook`. Twilio mostra a chamada chegando no console, mas a Voice URL do número (ou o webhook) não está conseguindo responder com o TwiML do ElevenLabs.

**Crons da Bia**
- `escalacao-pedidos-bia` e `bia-followup-cron` retornando **401** a cada minuto. O `bia-followup-cron` já tem `verify_jwt = false`, mas o cron job que o chama está sem o header de autorização correto.

## Plano

### 1. WhatsApp — descobrir por que `bia-core` parou de responder hoje
Vou abrir logs do `meta-webhook` e `_shared/bia-core.ts` filtrando pelo intervalo de hoje (a partir de ~00:00 UTC) e inspecionar:
- Se há erro de chamada ao Lovable AI Gateway (`LOVABLE_API_KEY` inválida / saldo / rate limit).
- Se há erro ao enviar via Meta Cloud API (token expirado, `WABA_ID`, ou janela de 24h fechada).
- Se mudou alguma flag (`bia_ativa`, horário comercial — atenção: ontem 23:16 a Bia respondeu "estamos fechados").

Correção provável (uma das opções, definida após ver o log):
- Rotacionar/renovar `LOVABLE_API_KEY` ou token Meta.
- Ajustar `bia-core.ts` para retornar 200 com flag `fallback` em vez de cair silenciosamente (já é nosso padrão de RLS, replicar aqui).

### 2. Twilio Voice — fazer a Bia atender de novo
- Conferir no log do `twilio-voice-webhook` se Twilio está realmente chamando.
- Validar a **Voice URL** configurada no número Twilio +55 43 2398-0020 (deve apontar para `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/twilio-voice-webhook`, método POST). Vou pedir para você confirmar/colar a URL atual no console Twilio, pois não tenho acesso direto.
- Confirmar que `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` e o phone-number id do SIP/Twilio do ElevenLabs estão presentes em secrets (via `fetch_secrets`) e válidos. Se faltarem, vou pedir.
- Garantir que `twilio-voice-webhook` tenha `verify_jwt = false` no `supabase/config.toml` (atualmente não tem entrada explícita — vou adicionar para evitar qualquer regressão futura).

### 3. Crons retornando 401
- Adicionar/garantir `verify_jwt = false` em `escalacao-pedidos-bia` no `config.toml` (atualmente sem entrada).
- Verificar se o cron `bia-followup-cron` está chamando com o anon key correto (se sim, basta a flag acima).

## Detalhes técnicos

- Arquivos que devem ser tocados (após diagnóstico):
  - `supabase/config.toml` — adicionar blocos `[functions.twilio-voice-webhook]` e `[functions.escalacao-pedidos-bia]` com `verify_jwt = false`.
  - `supabase/functions/_shared/bia-core.ts` — possível ajuste no tratamento de erro/retorno 200 com flag, dependendo do log.
- Não vou mexer em `App.tsx`, rotas, providers nem na UI do `/whatsapp` — o problema é 100% backend/integração.

## Saída esperada

- Bia voltando a responder mensagens novas no WhatsApp da Central Gás.
- Chamadas em +55 43 2398-0020 sendo atendidas pela Bia via ElevenLabs.
- Crons da Bia parando de cuspir 401.

## O que preciso de você antes de implementar

1. Confirmar que posso **rotacionar/atualizar tokens** se eu identificar que o problema é credencial expirada (Meta WhatsApp token, ElevenLabs, ou Lovable API key).
2. Quando eu pedir, abrir o console Twilio e me mandar a **Voice URL configurada** no número +55 43 2398-0020 (Twilio Console → Phone Numbers → o número → "A call comes in" → URL).
