DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND qual LIKE '%cheques-docs%' OR with_check LIKE '%cheques-docs%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "cheques_docs_select_own_empresa"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cheques-docs' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);

CREATE POLICY "cheques_docs_insert_own_empresa"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cheques-docs' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);

CREATE POLICY "cheques_docs_update_own_empresa"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cheques-docs' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text)
WITH CHECK (bucket_id = 'cheques-docs' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);

CREATE POLICY "cheques_docs_delete_own_empresa"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cheques-docs' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);