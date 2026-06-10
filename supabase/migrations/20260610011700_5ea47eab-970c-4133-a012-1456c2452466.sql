
-- 1) Resolve current user's cliente ids (match via profile email/phone)
CREATE OR REPLACE FUNCTION public.get_current_user_cliente_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clientes c
  JOIN public.profiles p ON p.user_id = auth.uid()
  WHERE c.empresa_id = p.empresa_id
    AND (
      (c.email IS NOT NULL AND p.email IS NOT NULL AND lower(c.email) = lower(p.email))
      OR (c.telefone IS NOT NULL AND p.phone IS NOT NULL
          AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g'))
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_user_cliente_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_cliente_ids() TO authenticated, service_role;

-- 2) Clientes podem ver apenas seus próprios pedidos
DROP POLICY IF EXISTS "Clientes podem ver seus pedidos" ON public.pedidos;
CREATE POLICY "Clientes podem ver seus pedidos"
  ON public.pedidos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND canal_venda = 'Aplicativo'
    AND cliente_id IN (SELECT public.get_current_user_cliente_ids())
  );

DROP POLICY IF EXISTS "Clientes podem ver itens de seus pedidos" ON public.pedido_itens;
CREATE POLICY "Clientes podem ver itens de seus pedidos"
  ON public.pedido_itens FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND pedido_id IN (
      SELECT p.id FROM public.pedidos p
      WHERE p.canal_venda = 'Aplicativo'
        AND p.cliente_id IN (SELECT public.get_current_user_cliente_ids())
    )
  );

-- 3) integracoes_whatsapp: converter tenant isolation para RESTRICTIVE
DROP POLICY IF EXISTS "tenant_isolation_integracoes_whatsapp" ON public.integracoes_whatsapp;
CREATE POLICY "tenant_isolation_integracoes_whatsapp"
  ON public.integracoes_whatsapp
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR unidade_belongs_to_user_empresa(unidade_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR unidade_belongs_to_user_empresa(unidade_id)
  );

-- 4) Recriar políticas RESTRICTIVE com role 'public' como TO authenticated
DO $$
DECLARE
  r record;
  v_using text;
  v_check text;
  v_cmd text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'RESTRICTIVE'
      AND 'public' = ANY(roles)
      AND policyname LIKE 'tenant_isolation%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);

    v_cmd := CASE r.cmd
              WHEN 'ALL' THEN 'ALL'
              WHEN 'SELECT' THEN 'SELECT'
              WHEN 'INSERT' THEN 'INSERT'
              WHEN 'UPDATE' THEN 'UPDATE'
              WHEN 'DELETE' THEN 'DELETE'
              ELSE 'ALL' END;

    v_using := CASE WHEN r.qual IS NOT NULL THEN format(' USING (%s)', r.qual) ELSE '' END;
    v_check := CASE WHEN r.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', r.with_check) ELSE '' END;

    v_sql := format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated%s%s',
      r.policyname, r.tablename, v_cmd, v_using, v_check
    );
    EXECUTE v_sql;
  END LOOP;
END;
$$;
