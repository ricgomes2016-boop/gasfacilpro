
-- comprovantes-entrega: scope by empresa_id folder
DROP POLICY IF EXISTS comprovantes_storage_select ON storage.objects;
DROP POLICY IF EXISTS comprovantes_storage_insert ON storage.objects;
DROP POLICY IF EXISTS comprovantes_storage_update ON storage.objects;
DROP POLICY IF EXISTS comprovantes_storage_delete ON storage.objects;

CREATE POLICY comprovantes_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-entrega'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );

CREATE POLICY comprovantes_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes-entrega'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );

CREATE POLICY comprovantes_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprovantes-entrega'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );

CREATE POLICY comprovantes_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes-entrega'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  );

-- transp-comprovantes: scope by empresa_id folder
DROP POLICY IF EXISTS transp_comprovantes_select ON storage.objects;
DROP POLICY IF EXISTS transp_comprovantes_insert ON storage.objects;

CREATE POLICY transp_comprovantes_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'transp-comprovantes'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );

CREATE POLICY transp_comprovantes_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transp-comprovantes'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );
