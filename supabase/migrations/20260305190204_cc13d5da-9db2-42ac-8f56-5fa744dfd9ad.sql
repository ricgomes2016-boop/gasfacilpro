
DROP POLICY IF EXISTS concorrente_precos_insert ON public.concorrente_precos;
DROP POLICY IF EXISTS concorrente_precos_select ON public.concorrente_precos;
DROP POLICY IF EXISTS concorrente_precos_delete ON public.concorrente_precos;

CREATE POLICY "concorrente_precos_select" ON public.concorrente_precos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "concorrente_precos_insert" ON public.concorrente_precos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "concorrente_precos_delete" ON public.concorrente_precos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
