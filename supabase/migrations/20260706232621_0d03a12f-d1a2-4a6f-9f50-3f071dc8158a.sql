
-- 1. Dedupe movimentacoes_caixa
WITH dupes AS (
  SELECT id,
         row_number() OVER (PARTITION BY pedido_id, categoria ORDER BY created_at ASC, id ASC) AS rn
  FROM public.movimentacoes_caixa
  WHERE pedido_id IS NOT NULL
    AND categoria IN ('Venda Dinheiro','Venda Cheque')
)
DELETE FROM public.movimentacoes_caixa mc
USING dupes d
WHERE mc.id = d.id AND d.rn > 1;

-- 2. Dedupe movimentacoes_bancarias por (referencia_id, conta_bancaria_id) quando referencia_tipo='pedido' e categoria='venda'
WITH dupes AS (
  SELECT id,
         row_number() OVER (PARTITION BY referencia_id, conta_bancaria_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.movimentacoes_bancarias
  WHERE referencia_id IS NOT NULL
    AND referencia_tipo = 'pedido'
    AND categoria = 'venda'
)
DELETE FROM public.movimentacoes_bancarias mb
USING dupes d
WHERE mb.id = d.id AND d.rn > 1;

-- 3. Índices únicos parciais
CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_caixa_pedido_categoria_uniq
  ON public.movimentacoes_caixa(pedido_id, categoria)
  WHERE pedido_id IS NOT NULL AND categoria IN ('Venda Dinheiro','Venda Cheque');

CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_bancarias_pedido_venda_uniq
  ON public.movimentacoes_bancarias(referencia_id, conta_bancaria_id)
  WHERE referencia_id IS NOT NULL AND referencia_tipo = 'pedido' AND categoria = 'venda';
