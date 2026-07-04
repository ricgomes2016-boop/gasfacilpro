
DROP POLICY IF EXISTS "Admin/super_admin gerencia vínculos" ON public.contador_empresas;
CREATE POLICY "Admin/super_admin gerencia vínculos" ON public.contador_empresas
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = public.get_user_empresa_id())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = public.get_user_empresa_id())
);

DROP POLICY IF EXISTS "Gestores can view all roles" ON public.user_roles;
CREATE POLICY "Gestores can view roles same empresa" ON public.user_roles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'gestor'::app_role) AND public.user_in_same_empresa(user_id))
);
