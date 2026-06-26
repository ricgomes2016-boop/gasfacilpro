-- Replace legacy broad authenticated RLS policies on tenant-scoped tables.
-- The previous tenant_guard_* restrictive policies already enforce isolation,
-- but old USING (true) / WITH CHECK (true) policies are noisy and confusing.
-- This migration adds an explicit tenant-scoped permissive policy, then drops
-- legacy broad policies on private tenant tables.

DO $$
DECLARE
  r record;
  p record;
  v_policy_name text;
  v_using text;
  v_check text;
  v_has_empresa boolean;
  v_has_unidade boolean;
  v_public_anon_tables text[] := ARRAY[
    'empresas',
    'unidades',
    'produtos',
    'configuracoes_visuais',
    'promocoes',
    'cupons_desconto',
    'canais_venda'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> ALL(v_public_anon_tables)
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = c.relname
          AND col.column_name IN ('empresa_id', 'unidade_id')
      )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r.table_name
        AND column_name = 'empresa_id'
    ) INTO v_has_empresa;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r.table_name
        AND column_name = 'unidade_id'
    ) INTO v_has_unidade;

    v_policy_name := 'tenant_permit_' || r.table_name;
    v_using := 'public.has_role(auth.uid(), ''super_admin''::public.app_role)';
    v_check := 'public.has_role(auth.uid(), ''super_admin''::public.app_role)';

    IF v_has_empresa THEN
      v_using := v_using || format(
        ' OR (%1$I IS NOT NULL AND (%1$I = public.get_user_empresa_id() OR public.contador_has_empresa(auth.uid(), %1$I)))',
        'empresa_id'
      );
      v_check := v_check || format(
        ' OR (%1$I IS NOT NULL AND %1$I = public.get_user_empresa_id())',
        'empresa_id'
      );
    END IF;

    IF v_has_unidade THEN
      v_using := v_using || format(
        ' OR (%1$I IS NOT NULL AND public.unidade_belongs_to_user_empresa(%1$I))',
        'unidade_id'
      );
      v_check := v_check || format(
        ' OR (%1$I IS NOT NULL AND public.unidade_belongs_to_user_empresa(%1$I))',
        'unidade_id'
      );
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      v_policy_name,
      r.table_name,
      v_using,
      v_check
    );

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = r.table_name
        AND policyname NOT IN (v_policy_name, 'tenant_guard_' || r.table_name)
        AND (
          lower(coalesce(qual, '')) IN ('true', '(true)', 'auth.uid() is not null', '(auth.uid() is not null)')
          OR lower(coalesce(with_check, '')) IN ('true', '(true)', 'auth.uid() is not null', '(auth.uid() is not null)')
        )
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, r.table_name);
    END LOOP;
  END LOOP;
END $$;
