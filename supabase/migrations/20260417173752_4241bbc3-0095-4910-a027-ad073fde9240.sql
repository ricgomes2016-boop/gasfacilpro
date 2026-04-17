ALTER TABLE public.transp_compras
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transp_compras_vencimento ON public.transp_compras(data_vencimento) WHERE pago = false;