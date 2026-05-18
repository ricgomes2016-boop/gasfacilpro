
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS escalado_em timestamptz,
  ADD COLUMN IF NOT EXISTS escalado_para text;

CREATE INDEX IF NOT EXISTS idx_pedidos_escalacao_bia
  ON public.pedidos (status, canal_venda, created_at)
  WHERE escalado_em IS NULL;
