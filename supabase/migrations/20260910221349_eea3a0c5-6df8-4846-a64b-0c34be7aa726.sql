DROP POLICY IF EXISTS "tenant_isolation_configuracoes_visuais" ON public.configuracoes_visuais;

CREATE POLICY "tenant_isolation_configuracoes_visuais"
ON public.configuracoes_visuais
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS "tenant_isolation_unidades" ON public.unidades;