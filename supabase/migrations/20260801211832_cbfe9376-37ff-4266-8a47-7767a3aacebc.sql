CREATE POLICY tenant_isolation_ro_ajustes_mensais
ON public.ro_ajustes_mensais
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR public.unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY tenant_isolation_vendedor_metas
ON public.vendedor_metas
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR public.unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR public.unidade_belongs_to_user_empresa(unidade_id));