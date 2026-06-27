## Problema

Em `src/hooks/useMapaOperacionalData.ts`, as consultas a `entregadores` e `pedidos` aplicam `.eq("empresa_id", empresaId)` quando `empresaId` está definido. Mas nenhuma dessas tabelas tem a coluna `empresa_id` no schema atual — o que faz a query do PostgREST falhar silenciosamente e retornar `data = null`. Resultado: `entregadores` fica vazio e nenhum marcador aparece no Mapa Operacional.

A isolação por tenant já é garantida por `unidade_id` + RLS, então o filtro extra de `empresa_id` é desnecessário e quebra a busca.

## Correção

Em `src/hooks/useMapaOperacionalData.ts`:

1. Remover o `if (empresaId) eq = eq.eq("empresa_id", empresaId);` da consulta a `entregadores`.
2. Remover o `if (empresaId) pq = pq.eq("empresa_id", empresaId);` da consulta a `pedidos`.
3. Manter o parâmetro `empresaId` na assinatura do hook (para não quebrar chamadores), mas não usá-lo nas queries.

Nenhuma outra alteração no `MapaOperacional.tsx` ou nos componentes do mapa.

## Validação

- Abrir `/operacional/mapa` com a unidade Forte Gás / Central Gás selecionada e confirmar que os entregadores ativos aparecem na lista lateral e no mapa (quando têm GPS).
- Conferir KPI "Online / Em rota / Offline" populando com os valores reais de presença.
