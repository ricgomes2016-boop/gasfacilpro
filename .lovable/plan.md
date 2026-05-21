## Follow-up automático da Bia (5 min) com desconto de R$ 5,00

Quando um cliente conversa no WhatsApp, pergunta preço mas **não fecha pedido**, a Bia deve voltar sozinha após 5 minutos oferecendo um desconto de R$ 5,00 para tentar converter a venda.

### Como vai funcionar

1. Toda vez que a Bia responde no WhatsApp (em `gateway-webhook` e webhooks Meta), o sistema registra/atualiza um "follow-up pendente" para aquela conversa, com horário de disparo = agora + 5 min.
2. Se o cliente **fecha pedido** (tag `[PEDIDO_CONFIRMADO]` processada), **manda nova mensagem**, ou está **fora do horário**, o follow-up é cancelado/reagendado.
3. Um **cron job** roda a cada 1 minuto, busca follow-ups vencidos cuja última mensagem foi da Bia (assistant) com sinal de "perguntou preço" e ainda sem pedido criado nos últimos 30 min → dispara mensagem de reengajamento com cupom de R$ 5,00.
4. Cada conversa só recebe **1 follow-up por janela de 24h** para não virar spam.

### Critérios para disparar
- Última mensagem da conversa é `assistant` (Bia respondeu e cliente sumiu).
- Conversa contém intenção de preço (palavras: "preço", "valor", "quanto", "custa", "tá" + produto), detectado no momento do agendamento.
- Não houve `pedido` criado para esse telefone nos últimos 30 minutos.
- Está dentro do horário comercial da unidade.
- Nenhum follow-up já enviado nas últimas 24h para essa conversa.

### Mensagem enviada
> "Oi {nome}! 👋 Notei que você se interessou pelo nosso gás. Pra fechar agora, libero **R$ 5,00 de desconto** no seu pedido. Posso anotar? 🔥"

O desconto é registrado no histórico da conversa como negociação válida (já existe `extractLatestNegotiatedDiscountPerUnit`), então se o cliente aceitar, o pedido sai com R$ 5,00 a menos automaticamente.

---

### Detalhes técnicos

**Nova tabela `bia_followups`**
- `conversa_id` (uuid, unique) · `telefone` · `unidade_id` · `empresa_id`
- `agendado_para` (timestamptz) · `enviado_em` (timestamptz null) · `status` (`pendente`/`enviado`/`cancelado`/`convertido`)
- `motivo` (texto curto, ex.: "preco_sem_pedido") · `tentativas` (int)
- RLS: leitura por empresa, escrita só por service role.

**Agendamento (no `bia-core.ts`)**
- Após `saveMessage(assistant)`: se reply não contém `[PEDIDO_CONFIRMADO]` e mensagem do cliente parece pergunta de preço → upsert em `bia_followups` com `agendado_para = now() + 5min`.
- Se reply contém `[PEDIDO_CONFIRMADO]` → marcar follow-up como `convertido`.
- Se nova mensagem do cliente chega antes do disparo → cancelar/atualizar (reagenda só se voltar a perguntar preço).

**Edge function `bia-followup-cron`**
- `verify_jwt = false`, chamada por `pg_cron` a cada 1 minuto via `extensions.http_post`.
- Busca follow-ups `pendente` com `agendado_para <= now()`.
- Valida horário comercial (`checkBusinessHours`) e ausência de pedido recente.
- Envia mensagem via `sendMessage` (reaproveita `resolveConfig` por `unidade_id`).
- Salva mensagem como `assistant` no `ai_mensagens` com metadado `{ follow_up: true, desconto_oferecido: 5 }`.
- Marca `status = enviado`.

**Cron**
- `SELECT cron.schedule('bia-followup-1min', '* * * * *', $$ SELECT extensions.http_post(...) $$);`

### Arquivos
- **Migração**: tabela `bia_followups` + RLS + cron job.
- **Editar**: `supabase/functions/_shared/bia-core.ts` (helpers `scheduleFollowup`, `cancelFollowup`, detecção de intenção de preço).
- **Editar**: `supabase/functions/gateway-webhook/index.ts` e demais webhooks da Bia (Meta/Twilio) para chamar os helpers.
- **Criar**: `supabase/functions/bia-followup-cron/index.ts`.
- **Editar**: `supabase/config.toml` (adicionar bloco da nova função com `verify_jwt = false`).

Sem mudanças em `App.tsx`, rotas, providers ou na UI do chat.
