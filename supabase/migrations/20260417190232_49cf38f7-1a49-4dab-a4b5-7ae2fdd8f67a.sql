-- Add new columns to transp_compras for Base44-style purchase analysis
ALTER TABLE public.transp_compras
  ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cnpj_destinatario text,
  ADD COLUMN IF NOT EXISTS tipo_produto text CHECK (tipo_produto IN ('cheio','vasilhame','outros')),
  ADD COLUMN IF NOT EXISTS preco_unitario numeric,
  ADD COLUMN IF NOT EXISTS quantidade numeric,
  ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transp_compras_empresa_mes_unidade
  ON public.transp_compras (empresa_id, mes_referencia, unidade_id);

CREATE INDEX IF NOT EXISTS idx_transp_compras_tipo_produto
  ON public.transp_compras (tipo_produto);