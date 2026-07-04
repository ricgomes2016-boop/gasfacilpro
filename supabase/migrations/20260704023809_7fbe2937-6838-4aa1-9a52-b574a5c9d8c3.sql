
-- 1) Remove política permissiva duplicada em chat_mensagens
DROP POLICY IF EXISTS "tenant_isolation_chat_mensagens" ON public.chat_mensagens;

-- 2) Política RESTRICTIVE de isolamento por empresa em unidades
DROP POLICY IF EXISTS "tenant_isolation_unidades_restrict" ON public.unidades;
CREATE POLICY "tenant_isolation_unidades_restrict"
  ON public.unidades AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR empresa_id = public.get_user_empresa_id()
    OR public.contador_has_empresa(auth.uid(), empresa_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR empresa_id = public.get_user_empresa_id()
  );

-- 3) Política RESTRICTIVE em whatsapp_gateway_messages
DROP POLICY IF EXISTS "tenant_isolation_whatsapp_gateway_messages_restrict" ON public.whatsapp_gateway_messages;
CREATE POLICY "tenant_isolation_whatsapp_gateway_messages_restrict"
  ON public.whatsapp_gateway_messages AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR instance_id IN (
      SELECT wi.id FROM public.whatsapp_gateway_instances wi
      WHERE wi.empresa_id = public.get_user_empresa_id()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR instance_id IN (
      SELECT wi.id FROM public.whatsapp_gateway_instances wi
      WHERE wi.empresa_id = public.get_user_empresa_id()
    )
  );

-- 4) Endurece política de user_roles: admin não pode ler/alterar linhas que já sejam admin/super_admin
--    e nunca pode gravar linhas com role admin/super_admin. Super_admin continua tendo acesso pela
--    política própria "Super admin can manage all roles".
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.user_in_same_empresa(user_id)
    AND role <> ALL (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role])
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.user_in_same_empresa(user_id)
    AND role <> ALL (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role])
  );
