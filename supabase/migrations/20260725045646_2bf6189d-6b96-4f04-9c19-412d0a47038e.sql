-- Reforça a política RESTRICTIVE de user_roles para bloquear explicitamente
-- que usuários com role 'gestor' (ou qualquer role não super_admin/admin)
-- atribuam roles elevadas (super_admin, admin, gestor, financeiro).
DROP POLICY IF EXISTS tenant_isolation_user_roles ON public.user_roles;

CREATE POLICY tenant_isolation_user_roles
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR user_in_same_empresa(user_id)
)
WITH CHECK (
  -- Somente super_admin pode atribuir qualquer role, ou admin (limitado)
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_in_same_empresa(user_id)
    AND role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role, 'gestor'::app_role, 'financeiro'::app_role])
  )
);