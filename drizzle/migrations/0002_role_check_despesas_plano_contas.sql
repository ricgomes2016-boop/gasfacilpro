-- Exige papel financeiro (admin/gestor/financeiro) ou contador vinculado para
-- criar/alterar despesas contábeis e plano de contas.
DROP POLICY IF EXISTS "Staff e contador inserem despesas" ON public.despesas_contabeis;
CREATE POLICY "Staff e contador inserem despesas"
  ON public.despesas_contabeis FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id = get_user_empresa_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'gestor'::app_role) OR
      has_role(auth.uid(), 'financeiro'::app_role)
    ))
    OR contador_has_empresa(auth.uid(), empresa_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Staff e contador atualizam despesas" ON public.despesas_contabeis;
CREATE POLICY "Staff e contador atualizam despesas"
  ON public.despesas_contabeis FOR UPDATE TO authenticated
  USING (
    (empresa_id = get_user_empresa_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'gestor'::app_role) OR
      has_role(auth.uid(), 'financeiro'::app_role)
    ))
    OR contador_has_empresa(auth.uid(), empresa_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Staff/contador insere plano de contas" ON public.plano_contas;
CREATE POLICY "Staff/contador insere plano de contas"
  ON public.plano_contas FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id = get_user_empresa_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'gestor'::app_role) OR
      has_role(auth.uid(), 'financeiro'::app_role)
    ))
    OR contador_has_empresa(auth.uid(), empresa_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Staff/contador atualiza plano de contas" ON public.plano_contas;
CREATE POLICY "Staff/contador atualiza plano de contas"
  ON public.plano_contas FOR UPDATE TO authenticated
  USING (
    (empresa_id = get_user_empresa_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'gestor'::app_role) OR
      has_role(auth.uid(), 'financeiro'::app_role)
    ))
    OR contador_has_empresa(auth.uid(), empresa_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );