-- 1) configuracoes_visuais: remove dead/over-broad "unidade_id IS NULL" condition
DROP POLICY IF EXISTS "Authenticated staff can read visual configs of own empresa" ON public.configuracoes_visuais;
CREATE POLICY "Authenticated staff can read visual configs of own empresa"
ON public.configuracoes_visuais FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS "tenant_isolation_configuracoes_visuais" ON public.configuracoes_visuais;
CREATE POLICY "tenant_isolation_configuracoes_visuais"
ON public.configuracoes_visuais FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

-- 2) user_roles: switch admin role management from deny-list to explicit allow-list
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_in_same_empresa(user_id)
  AND role = ANY (ARRAY['operacional'::app_role,'entregador'::app_role,'cliente'::app_role,'parceiro'::app_role,'contador'::app_role,'transportadora'::app_role,'vendedor'::app_role])
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_in_same_empresa(user_id)
  AND role = ANY (ARRAY['operacional'::app_role,'entregador'::app_role,'cliente'::app_role,'parceiro'::app_role,'contador'::app_role,'transportadora'::app_role,'vendedor'::app_role])
);