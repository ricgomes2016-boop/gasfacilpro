
## Objetivo

Pausar temporariamente o atendimento normal da Bia para a empresa **Central Gás** (slug `central-gas`, que inclui as unidades Central Gas, Forte Gás e Japa Gás). Sempre que um cliente enviar mensagem — seja pelo WhatsApp (qualquer provedor) ou pelo chat do site institucional — a Bia deve responder apenas:

> "Este WhatsApp está indisponível, por favor envie mensagem para o número 43 99966-1816. Obrigada."

Nenhum processamento de IA, criação de pedido, follow-up, cobrança ou consulta a produtos deve acontecer. Outras empresas do ERP continuam com a Bia normal.

## Como fazer

### 1. Helper central em `supabase/functions/_shared/bia-core.ts`
- Adicionar constante `BIA_PAUSED_EMPRESA_SLUGS = ["central-gas"]` e a mensagem fixa `BIA_PAUSED_MESSAGE`.
- Adicionar função `isBiaPaused(supabase, config)` que, dado um `BiaConfig`, faz um lookup rápido `unidades → empresas.slug` e retorna `true` se o slug estiver na lista de pausados. Cachear por `unidade_id` no escopo do request.

### 2. Webhooks de WhatsApp
Nos arquivos `evolution-webhook`, `meta-webhook`, `zapi-webhook`, `uazapi-webhook`, `gateway-webhook`, logo após `resolveConfig(...)` e antes de qualquer chamada de IA/áudio/negociação:

```text
if (await isBiaPaused(supabase, config)) {
  await sendMessage(config, phone, BIA_PAUSED_MESSAGE);
  // registrar mensagem enviada em ai_conversas (mesmo padrão atual) para histórico
  return 200 OK;
}
```

- Não cancelar follow-ups já agendados aqui; apenas não gerar novos.
- Manter deduplicação existente (não responder de novo se a última resposta enviada nas últimas X mensagens já é a mensagem fixa) para evitar spam quando o cliente mandar várias mensagens seguidas.

### 3. Chat do site (`bia-site-chat/index.ts`)
- Após resolver `empresa` pelo slug, se `empresa.slug === "central-gas"` (ou seja, sempre, já que os três slugs mapeados hoje apontam para essa empresa), retornar imediatamente a mensagem fixa no mesmo formato de streaming/JSON que o frontend já consome, sem chamar o modelo nem executar tools.

### 4. Cron de follow-up (`bia-followup-cron`) e escalação (`escalacao-pedidos-bia`)
- No loop, pular qualquer registro cuja `unidade → empresa.slug` esteja na lista pausada, para não disparar mensagens automáticas durante a pausa.

### 5. Voz (Twilio/ElevenLabs) — fora do escopo
- O pedido menciona apenas WhatsApp e site. A Bia por voz não é alterada nesta tarefa.

## Como reverter depois
Basta remover `"central-gas"` da constante `BIA_PAUSED_EMPRESA_SLUGS` e fazer redeploy das funções acima. Nenhuma configuração de banco é alterada.

## Arquivos afetados
- `supabase/functions/_shared/bia-core.ts` (novo helper + constantes)
- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/meta-webhook/index.ts`
- `supabase/functions/zapi-webhook/index.ts`
- `supabase/functions/uazapi-webhook/index.ts`
- `supabase/functions/gateway-webhook/index.ts`
- `supabase/functions/bia-site-chat/index.ts`
- `supabase/functions/bia-followup-cron/index.ts`
- `supabase/functions/escalacao-pedidos-bia/index.ts`

Nenhuma migração de banco, nenhuma mudança de UI e nenhum arquivo de frontend precisa ser tocado.
