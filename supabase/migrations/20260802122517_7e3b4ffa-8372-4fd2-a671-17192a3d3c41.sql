ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS data_movimento date NOT NULL DEFAULT current_date;

UPDATE public.movimentacoes_estoque SET data_movimento = created_at::date WHERE data_movimento IS DISTINCT FROM created_at::date;

CREATE INDEX IF NOT EXISTS idx_mov_estoque_unidade_data_produto
  ON public.movimentacoes_estoque (unidade_id, data_movimento, produto_id);

CREATE TABLE IF NOT EXISTS public.estoque_saldos_iniciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  definido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, produto_id, data_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_saldos_iniciais TO authenticated;
GRANT ALL ON public.estoque_saldos_iniciais TO service_role;

ALTER TABLE public.estoque_saldos_iniciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios da empresa gerenciam saldos iniciais"
ON public.estoque_saldos_iniciais
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (auth.uid() IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id));

CREATE TRIGGER trg_estoque_saldos_iniciais_updated_at
BEFORE UPDATE ON public.estoque_saldos_iniciais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();