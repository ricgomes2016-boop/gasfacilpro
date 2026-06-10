-- Harden delivery proof and storage policies when the target objects exist.
-- Some environments have schema drift around comprovantes_entrega, so this
-- migration is intentionally defensive to keep the migration queue unblocked.

DO $$
BEGIN
  IF to_regclass('public.comprovantes_entrega') IS NOT NULL THEN
    DROP POLICY IF EXISTS comprovantes_tenant_isolation ON public.comprovantes_entrega;

    CREATE POLICY comprovantes_tenant_isolation
    ON public.comprovantes_entrega
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.unidade_belongs_to_user_empresa(unidade_id)
      OR EXISTS (
        SELECT 1
        FROM public.entregadores e
        WHERE e.id = comprovantes_entrega.entregador_id
          AND e.user_id = auth.uid()
      )
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.unidade_belongs_to_user_empresa(unidade_id)
      OR EXISTS (
        SELECT 1
        FROM public.entregadores e
        WHERE e.id = comprovantes_entrega.entregador_id
          AND e.user_id = auth.uid()
      )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_storage_policy_role_if_exists(policy_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = set_storage_policy_role_if_exists.policy_name
  ) THEN
    EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated', policy_name);
  END IF;
END;
$$;

SELECT public.set_storage_policy_role_if_exists('Authenticated users can upload product images');
SELECT public.set_storage_policy_role_if_exists('Staff can update product images');
SELECT public.set_storage_policy_role_if_exists('Staff can delete product images');

SELECT public.set_storage_policy_role_if_exists('Users can upload own avatar');
SELECT public.set_storage_policy_role_if_exists('Users can update own avatar');
SELECT public.set_storage_policy_role_if_exists('Users can delete own avatar');

SELECT public.set_storage_policy_role_if_exists('Certificados: gestores atualizam da própria empresa');
SELECT public.set_storage_policy_role_if_exists('Certificados: gestores leem da própria empresa');
SELECT public.set_storage_policy_role_if_exists('Certificados: gestores enviam para a própria empresa');
SELECT public.set_storage_policy_role_if_exists('Certificados: gestores apagam da própria empresa');

SELECT public.set_storage_policy_role_if_exists('Staff can view boletos');
SELECT public.set_storage_policy_role_if_exists('Staff can upload boletos');
SELECT public.set_storage_policy_role_if_exists('Staff can update boletos');
SELECT public.set_storage_policy_role_if_exists('Staff can delete boletos');

SELECT public.set_storage_policy_role_if_exists('Staff can view documents');
SELECT public.set_storage_policy_role_if_exists('Staff can upload documents');
SELECT public.set_storage_policy_role_if_exists('Staff can update documents');
SELECT public.set_storage_policy_role_if_exists('Admin/Gestor can delete documents');

SELECT public.set_storage_policy_role_if_exists('staff_select_contabeis');
SELECT public.set_storage_policy_role_if_exists('staff_upload_contabeis');
SELECT public.set_storage_policy_role_if_exists('staff_update_contabeis');
SELECT public.set_storage_policy_role_if_exists('staff_delete_contabeis');

DROP FUNCTION public.set_storage_policy_role_if_exists(text);
