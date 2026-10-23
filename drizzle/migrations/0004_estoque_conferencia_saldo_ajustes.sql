CREATE TABLE public.estoque_conferencia_saldo_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_conferencia date NOT NULL,
  unidade_id uuid NOT NULL,
  produto_grupo text NOT NULL,
  cheio integer NOT NULL DEFAULT 0,
  vazio integer NOT NULL DEFAULT 0,
  editado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ecsa_grupo_chk CHECK (produto_grupo IN ('P13','P20','P45','Agua')),
  CONSTRAINT ecsa_qtd_chk CHECK (cheio >= 0 AND vazio >= 0),
  CONSTRAINT ecsa_unique UNIQUE (data_conferencia, unidade_id, produto_grupo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_conferencia_saldo_ajustes TO authenticated;
GRANT ALL ON public.estoque_conferencia_saldo_ajustes TO service_role;
ALTER TABLE public.estoque_conferencia_saldo_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecsa select" ON public.estoque_conferencia_saldo_ajustes FOR SELECT TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id));
CREATE POLICY "ecsa insert master" ON public.estoque_conferencia_saldo_ajustes FOR INSERT TO authenticated
  WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "ecsa update master" ON public.estoque_conferencia_saldo_ajustes FOR UPDATE TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "ecsa delete master" ON public.estoque_conferencia_saldo_ajustes FOR DELETE TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));