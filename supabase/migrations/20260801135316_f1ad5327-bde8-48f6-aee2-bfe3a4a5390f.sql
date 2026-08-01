CREATE TABLE IF NOT EXISTS public.estoque_conferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_conferencia date NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  produto_grupo text NOT NULL CHECK (produto_grupo IN ('P13', 'P20', 'P45', 'Agua')),
  tipo_estoque text NOT NULL CHECK (tipo_estoque IN ('cheio', 'vazio')),
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  conferido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_conferencia, unidade_id, produto_grupo, tipo_estoque)
);

CREATE INDEX IF NOT EXISTS idx_estoque_conferencias_data
  ON public.estoque_conferencias(data_conferencia);
CREATE INDEX IF NOT EXISTS idx_estoque_conferencias_unidade_data
  ON public.estoque_conferencias(unidade_id, data_conferencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_conferencias TO authenticated;
GRANT ALL ON public.estoque_conferencias TO service_role;

ALTER TABLE public.estoque_conferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver conferencias da sua empresa"
ON public.estoque_conferencias
FOR SELECT
TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "Usuarios podem criar conferencias da sua empresa"
ON public.estoque_conferencias
FOR INSERT
TO authenticated
WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "Usuarios podem atualizar conferencias da sua empresa"
ON public.estoque_conferencias
FOR UPDATE
TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "Usuarios podem excluir conferencias da sua empresa"
ON public.estoque_conferencias
FOR DELETE
TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE TRIGGER trg_estoque_conferencias_updated_at
BEFORE UPDATE ON public.estoque_conferencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();