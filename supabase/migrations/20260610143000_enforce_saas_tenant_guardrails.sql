-- Defense-in-depth guardrails for SaaS tenant isolation.
-- Adds restrictive RLS policies to every tenant-scoped public table that has
-- empresa_id or unidade_id, and removes broad anonymous access from private
-- tenant data. Public storefront/catalog tables keep explicit anon grants.

DO $$
DECLARE
  r record;
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
  v_skip_tables text[] := ARRAY[
    'spatial_ref_sys'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> ALL(v_skip_tables)
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

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);

    IF NOT (r.table_name = ANY(v_public_anon_tables)) THEN
      EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.%I FROM anon, PUBLIC', r.table_name);
    END IF;

    v_policy_name := 'tenant_guard_' || r.table_name;

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
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      v_policy_name,
      r.table_name,
      v_using,
      v_check
    );
  END LOOP;
END $$;

-- Keep the intentionally public read surface explicit and narrow.
GRANT SELECT ON public.empresas TO anon;
GRANT SELECT ON public.unidades TO anon;
GRANT SELECT ON public.produtos TO anon;
GRANT SELECT ON public.configuracoes_visuais TO anon;
GRANT SELECT ON public.promocoes TO anon;
GRANT SELECT ON public.cupons_desconto TO anon;
GRANT SELECT ON public.canais_venda TO anon;

-- Prevent public execution of tenant/security helper functions.
REVOKE EXECUTE ON FUNCTION public.get_user_empresa_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_empresa(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unidade_belongs_to_user_empresa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contador_has_empresa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_empresa_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_empresa(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unidade_belongs_to_user_empresa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contador_has_empresa(uuid, uuid) TO authenticated, service_role;

-- Keep product catalog images public, but stop exposing private proof folders
-- that were historically stored in the same bucket.
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'product-images'
  AND COALESCE((storage.foldername(name))[1], '') NOT IN ('comprovantes', 'cheques')
);

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND COALESCE((storage.foldername(name))[1], '') NOT IN ('comprovantes', 'cheques')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);
