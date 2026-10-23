CREATE TABLE public.estoque_conferencia_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_conferencia date NOT NULL,
  unidade_id uuid NOT NULL,
  produto_grupo text NOT NULL,
  tipo text NOT NULL DEFAULT 'entrada_manual',
  quantidade integer NOT NULL DEFAULT 0,
  unidade_destino_id uuid,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ecm_tipo_chk CHECK (tipo IN ('entrada_manual','transferencia')),
  CONSTRAINT ecm_grupo_chk CHECK (produto_grupo IN ('P13','P20','P45','Agua')),
  CONSTRAINT ecm_qtd_chk CHECK (quantidade >= 0)
);
CREATE INDEX idx_ecm_data ON public.estoque_conferencia_movimentos (data_conferencia, unidade_id);
CREATE INDEX idx_ecm_destino ON public.estoque_conferencia_movimentos (data_conferencia, unidade_destino_id);
CREATE UNIQUE INDEX ux_ecm_entrada ON public.estoque_conferencia_movimentos (data_conferencia, unidade_id, produto_grupo) WHERE tipo = 'entrada_manual';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_conferencia_movimentos TO authenticated;
GRANT ALL ON public.estoque_conferencia_movimentos TO service_role;
ALTER TABLE public.estoque_conferencia_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecm select" ON public.estoque_conferencia_movimentos FOR SELECT TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id) OR (unidade_destino_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_destino_id)));
CREATE POLICY "ecm insert" ON public.estoque_conferencia_movimentos FOR INSERT TO authenticated
  WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id) AND (unidade_destino_id IS NULL OR public.unidade_belongs_to_user_empresa(unidade_destino_id)));
CREATE POLICY "ecm update" ON public.estoque_conferencia_movimentos FOR UPDATE TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id))
  WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id) AND (unidade_destino_id IS NULL OR public.unidade_belongs_to_user_empresa(unidade_destino_id)));
CREATE POLICY "ecm delete" ON public.estoque_conferencia_movimentos FOR DELETE TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id));