# Backfill: corrigir descrições antigas em `contas_receber`

Atualizar títulos já criados antes do fix, substituindo a referência por UUID (`#A1B2C3D4`) pelo `numero_sequencial` do pedido.

## SQL (via tool `insert` — UPDATE, sem mudança de schema)

```sql
UPDATE public.contas_receber cr
SET descricao = regexp_replace(
  cr.descricao,
  '#[0-9A-F]{8}',
  '#' || p.numero_sequencial::text
)
FROM public.pedidos p
WHERE cr.pedido_id = p.id
  AND p.numero_sequencial IS NOT NULL
  AND cr.descricao ~ '#[0-9A-F]{8}';
```

## Escopo

- Atualiza apenas linhas com `pedido_id` vinculado e descrição contendo o padrão `#XXXXXXXX` (8 hex maiúsculos do fallback).
- Não toca em títulos de Vale Gás, despesas, ou descrições já com número sequencial.
- Operação idempotente — rodar de novo não altera nada.
