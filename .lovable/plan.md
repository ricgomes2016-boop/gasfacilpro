## Objetivo
Qualquer pedido cujo status não tenha mudado nos últimos 5 minutos (e ainda esteja em andamento) dispara um WhatsApp de alerta para o número configurado em `unidades.whatsapp_notificacao_pedido` (fallback `5543999692765`).

## Mudanças

### 1) Banco
Migration:
- Coluna `pedidos.alerta_atraso_enviado_em timestamptz` (nullable) — marca quando o alerta foi enviado, evitando spam.
- Coluna `pedidos.status_atualizado_em timestamptz` com default `now()`.
- Trigger `BEFORE UPDATE` em `pedidos`: quando `status` mudar, atualiza `status_atualizado_em = now()` e zera `alerta_atraso_enviado_em` (permitindo re-alertar se o próximo status também travar).
- Backfill: `status_atualizado_em = COALESCE(updated_at, created_at)` para registros existentes.

### 2) Nova Edge Function `pedidos-alerta-atraso`
- Roda a cada 1 minuto.
- Busca pedidos com:
  - `status IN ('pendente','agendado','em_separacao','em_rota','saiu_para_entrega')` (status ainda em aberto — exclui `entregue`, `cancelado`, `concluido`)
  - `status_atualizado_em <= now() - interval '5 minutes'`
  - `alerta_atraso_enviado_em IS NULL`
- Para cada pedido: carrega `unidade.whatsapp_notificacao_pedido` + config WhatsApp ativa da unidade (`integracoes_whatsapp` ativo), monta mensagem:
  ```
  ⚠️ Pedido parado há mais de 5 min
  #<id> — <unidade>
  Status atual: <status> (desde <hh:mm>)
  Cliente: <nome> (<telefone>)
  📍 <endereço>
  ```
- Envia via helper `sendMessage` reaproveitada de `_shared/bia-core.ts`.
- Marca `alerta_atraso_enviado_em = now()` no pedido para não reenviar.
- Erros logados, não bloqueantes.

### 3) Agendamento (pg_cron)
Via tool `insert` (não migration, contém URL/anon key):
```sql
select cron.schedule(
  'pedidos-alerta-atraso-1min',
  '* * * * *',
  $$ select net.http_post(
       url:='https://<project>.supabase.co/functions/v1/pedidos-alerta-atraso',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb) $$
);
```
Habilita `pg_cron` e `pg_net` se ainda não estiverem.

## Detalhes técnicos
- Não envia se a unidade não tiver `whatsapp_notificacao_pedido` configurado e o fallback estiver vazio.
- Se a unidade não tiver integração WhatsApp ativa, busca a primeira `integracoes_whatsapp` ativa da empresa como fallback.
- Apenas 1 alerta por "trecho de status": ao mudar de status, o trigger zera o flag, então se o próximo status também travar 5 min, novo alerta é disparado.
- Não altera UI, dashboard, nem fluxos existentes.
