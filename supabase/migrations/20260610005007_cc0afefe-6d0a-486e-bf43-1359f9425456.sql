
-- 1) Fix cliente_enderecos restrictive policy: cover NULL cliente_id and user-owned rows safely
DROP POLICY IF EXISTS tenant_isolation_cliente_enderecos ON public.cliente_enderecos;

CREATE POLICY tenant_isolation_cliente_enderecos
ON public.cliente_enderecos
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    cliente_id IS NOT NULL
    AND cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.empresa_id = get_user_empresa_id())
  )
  OR (cliente_id IS NULL AND user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    cliente_id IS NOT NULL
    AND cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.empresa_id = get_user_empresa_id())
  )
  OR (cliente_id IS NULL AND user_id = auth.uid())
);

-- 2) Convert all PERMISSIVE policies in schema public from role "public" to "authenticated"
DO $$
DECLARE
  r record;
  v_cmd text;
  v_using text;
  v_check text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
      AND 'public' = ANY (roles)
  LOOP
    v_cmd := r.cmd; -- 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'
    v_using := r.qual;
    v_check := r.with_check;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);

    v_sql := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO authenticated',
                    r.policyname, r.tablename, v_cmd);

    IF v_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;

    EXECUTE v_sql;
  END LOOP;
END $$;
