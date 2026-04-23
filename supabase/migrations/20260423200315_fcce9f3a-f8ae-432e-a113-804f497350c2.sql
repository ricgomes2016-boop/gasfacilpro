
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS is_transporte boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_funcionarios_is_transporte
  ON public.funcionarios(is_transporte) WHERE is_transporte = true;
