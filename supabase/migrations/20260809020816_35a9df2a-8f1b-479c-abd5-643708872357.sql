DROP POLICY IF EXISTS "Admin/gestor can view audit logs" ON public.audit_log;
CREATE POLICY "Admin/gestor can view audit logs"
ON public.audit_log FOR SELECT TO authenticated
USING (
  empresa_id = get_user_empresa_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);