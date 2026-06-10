
-- 1) Hide sensitive credential columns from client reads (anon + authenticated)
--    service_role still has full access via GRANT ALL. Some environments may
--    not have every credential column yet, so revoke only existing columns.
DO $$
DECLARE
  sensitive_columns text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO sensitive_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'configuracoes_empresa'
    AND column_name IN ('asaas_api_key', 'asaas_webhook_token');

  IF sensitive_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT (%s) ON public.configuracoes_empresa FROM authenticated, anon',
      sensitive_columns
    );
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO sensitive_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'integracoes_whatsapp'
    AND column_name IN ('token', 'security_token', 'meta_access_token', 'meta_verify_token', 'instancia_token');

  IF sensitive_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT (%s) ON public.integracoes_whatsapp FROM authenticated, anon',
      sensitive_columns
    );
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO sensitive_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'social_accounts'
    AND column_name IN ('token', 'refresh_token', 'access_token');

  IF sensitive_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT (%s) ON public.social_accounts FROM authenticated, anon',
      sensitive_columns
    );
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO sensitive_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'transp_outlook_config'
    AND column_name IN ('microsoft_refresh_token');

  IF sensitive_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT (%s) ON public.transp_outlook_config FROM authenticated, anon',
      sensitive_columns
    );
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO sensitive_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'unidades'
    AND column_name IN ('certificado_a1_senha', 'certificado_a1_path', 'nfce_csc_token', 'nfce_csc_id', 'provedor_nfe_token');

  IF sensitive_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT (%s) ON public.unidades FROM authenticated, anon',
      sensitive_columns
    );
  END IF;
END $$;

-- 2) Scope policies TO authenticated (drop+recreate on public role)

-- unidades
DROP POLICY IF EXISTS "Admin/Gestor can manage unidades" ON public.unidades;
CREATE POLICY "Admin/Gestor can manage unidades" ON public.unidades
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "Admins can delete unidades" ON public.unidades;
CREATE POLICY "Admins can delete unidades" ON public.unidades
  FOR DELETE TO authenticated
  USING ((empresa_id = get_user_empresa_id()) AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert unidades" ON public.unidades;
CREATE POLICY "Admins can insert unidades" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK ((empresa_id = get_user_empresa_id()) AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update unidades" ON public.unidades;
CREATE POLICY "Admins can update unidades" ON public.unidades
  FOR UPDATE TO authenticated
  USING ((empresa_id = get_user_empresa_id()) AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can view empresa unidades" ON public.unidades;
CREATE POLICY "Staff can view empresa unidades" ON public.unidades
  FOR SELECT TO authenticated
  USING ((empresa_id = get_user_empresa_id()) OR (empresa_id IS NULL));

DROP POLICY IF EXISTS "tenant_isolation_unidades" ON public.unidades;
CREATE POLICY "tenant_isolation_unidades" ON public.unidades
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (empresa_id = get_user_empresa_id()) OR contador_has_empresa(auth.uid(), empresa_id));

-- configuracoes_empresa
DROP POLICY IF EXISTS "Privileged users view configuracoes" ON public.configuracoes_empresa;
CREATE POLICY "Privileged users view configuracoes" ON public.configuracoes_empresa
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- integracoes_whatsapp
DROP POLICY IF EXISTS "tenant_isolation_integracoes_whatsapp" ON public.integracoes_whatsapp;
CREATE POLICY "tenant_isolation_integracoes_whatsapp" ON public.integracoes_whatsapp
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

-- transp_outlook_config
DO $$
BEGIN
  IF to_regclass('public.transp_outlook_config') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin/Gestor delete outlook config" ON public.transp_outlook_config';
    EXECUTE 'CREATE POLICY "Admin/Gestor delete outlook config" ON public.transp_outlook_config
      FOR DELETE TO authenticated
      USING (user_belongs_to_empresa(auth.uid(), empresa_id) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))';

    EXECUTE 'DROP POLICY IF EXISTS "Admin/Gestor insert outlook config" ON public.transp_outlook_config';
    EXECUTE 'CREATE POLICY "Admin/Gestor insert outlook config" ON public.transp_outlook_config
      FOR INSERT TO authenticated
      WITH CHECK (user_belongs_to_empresa(auth.uid(), empresa_id) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))';

    EXECUTE 'DROP POLICY IF EXISTS "Admin/Gestor update outlook config" ON public.transp_outlook_config';
    EXECUTE 'CREATE POLICY "Admin/Gestor update outlook config" ON public.transp_outlook_config
      FOR UPDATE TO authenticated
      USING (user_belongs_to_empresa(auth.uid(), empresa_id) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))';

    EXECUTE 'DROP POLICY IF EXISTS "Admin/Gestor view outlook config" ON public.transp_outlook_config';
    EXECUTE 'CREATE POLICY "Admin/Gestor view outlook config" ON public.transp_outlook_config
      FOR SELECT TO authenticated
      USING (user_belongs_to_empresa(auth.uid(), empresa_id) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))';
  END IF;
END $$;

-- whatsapp_gateway_instances
DO $$
BEGIN
  IF to_regclass('public.whatsapp_gateway_instances') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin/Gestor manage whatsapp gateway instances" ON public.whatsapp_gateway_instances';
    EXECUTE 'CREATE POLICY "Admin/Gestor manage whatsapp gateway instances" ON public.whatsapp_gateway_instances
      FOR ALL TO authenticated
      USING (((empresa_id = get_user_empresa_id()) OR has_role(auth.uid(), ''super_admin''::app_role)) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))
      WITH CHECK (((empresa_id = get_user_empresa_id()) OR has_role(auth.uid(), ''super_admin''::app_role)) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))';

    EXECUTE 'DROP POLICY IF EXISTS "Admin/Gestor view whatsapp gateway instances" ON public.whatsapp_gateway_instances';
    EXECUTE 'CREATE POLICY "Admin/Gestor view whatsapp gateway instances" ON public.whatsapp_gateway_instances
      FOR SELECT TO authenticated
      USING (((empresa_id = get_user_empresa_id()) OR has_role(auth.uid(), ''super_admin''::app_role)) AND (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''gestor''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)))';
  END IF;
END $$;

-- cliente_enderecos: scope public→authenticated and allow cliente_id IS NULL for own rows
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.cliente_enderecos;
CREATE POLICY "Users can delete own addresses" ON public.cliente_enderecos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own addresses" ON public.cliente_enderecos;
CREATE POLICY "Users can insert own addresses" ON public.cliente_enderecos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own addresses" ON public.cliente_enderecos;
CREATE POLICY "Users can update own addresses" ON public.cliente_enderecos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own addresses" ON public.cliente_enderecos;
CREATE POLICY "Users can view own addresses" ON public.cliente_enderecos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- pedidos: scope remaining public policies to authenticated
DROP POLICY IF EXISTS "Pedidos insert isolado" ON public.pedidos;
CREATE POLICY "Pedidos insert isolado" ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS "Pedidos isolados por empresa" ON public.pedidos;
CREATE POLICY "Pedidos isolados por empresa" ON public.pedidos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS "Pedidos update isolado" ON public.pedidos;
CREATE POLICY "Pedidos update isolado" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS "Staff can manage pedidos" ON public.pedidos;
CREATE POLICY "Staff can manage pedidos" ON public.pedidos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'operacional'::app_role) OR has_role(auth.uid(), 'entregador'::app_role));

DROP POLICY IF EXISTS "Entregadores can update pedidos" ON public.pedidos;
CREATE POLICY "Entregadores can update pedidos" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'entregador'::app_role) AND (
      (entregador_id IN (SELECT id FROM entregadores WHERE user_id = auth.uid()))
      OR ((entregador_id IS NULL) AND (status = 'pendente'::text))
    )
  );
