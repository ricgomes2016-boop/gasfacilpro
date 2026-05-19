ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS conferida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conferida_em timestamptz,
  ADD COLUMN IF NOT EXISTS conferida_por uuid,
  ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS tipo_produto text NOT NULL DEFAULT 'outros';

CREATE INDEX IF NOT EXISTS idx_compras_conferida ON public.compras(conferida);
CREATE INDEX IF NOT EXISTS idx_compras_pago ON public.compras(pago);
CREATE INDEX IF NOT EXISTS idx_compras_tipo_produto ON public.compras(tipo_produto);