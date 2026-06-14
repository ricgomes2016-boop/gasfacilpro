
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS is_vendedor BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.vendedor_metas
  ADD COLUMN IF NOT EXISTS tipo_comissao TEXT NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS valor_fixo_comissao NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_venda_permitido TEXT NOT NULL DEFAULT 'ambos',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vendedor_metas_funcionario ON public.vendedor_metas(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_is_vendedor ON public.funcionarios(is_vendedor) WHERE is_vendedor = true;
