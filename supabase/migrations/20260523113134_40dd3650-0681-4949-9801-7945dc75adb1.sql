
-- ============================================================
-- Security hardening: restrict access to sensitive credentials
-- ============================================================

-- 1) Column-level revokes for sensitive columns (Postgres enforces these
--    independently from RLS, so even existing SELECT policies cannot return them)

-- configuracoes_empresa: payment gateway secrets
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated, anon';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- integracoes_whatsapp: provider tokens
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (token, instancia_token, security_token, meta_access_token, meta_verify_token) ON public.integracoes_whatsapp FROM authenticated, anon';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- social_accounts: OAuth tokens
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (access_token, refresh_token, token) ON public.social_accounts FROM authenticated, anon';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- unidades: certificate password and fiscal tokens
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (certificado_a1_senha, provedor_nfe_token, nfce_csc_token) ON public.unidades FROM authenticated, anon';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- whatsapp_gateway_instances: api keys & secrets
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (api_key, webhook_secret, session_data) ON public.whatsapp_gateway_instances FROM authenticated, anon';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- 2) Remove legacy permissive contabil storage policies that grant
--    any authenticated user read/delete on contabil buckets.
DROP POLICY IF EXISTS "Contador/staff lê XMLs contábeis" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff remove XMLs contábeis" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff lê despesas escaneadas" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff remove despesas escaneadas" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff lê extratos contábeis" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff remove extratos contábeis" ON storage.objects;
-- (Legacy INSERT counterparts, if any)
DROP POLICY IF EXISTS "Contador/staff envia XMLs contábeis" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff envia despesas escaneadas" ON storage.objects;
DROP POLICY IF EXISTS "Contador/staff envia extratos contábeis" ON storage.objects;

-- 3) Tighten vehicle-photos: restrict mutations to admin/gestor
DROP POLICY IF EXISTS "Authenticated users can delete vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload vehicle photos" ON storage.objects;

CREATE POLICY "vehicle_photos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
  );

CREATE POLICY "vehicle_photos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );

CREATE POLICY "vehicle_photos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );
