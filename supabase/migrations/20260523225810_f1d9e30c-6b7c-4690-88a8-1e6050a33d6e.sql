
-- 1) Remove overly permissive policy on avaliacoes_entrega
DROP POLICY IF EXISTS "Authenticated can view all reviews" ON public.avaliacoes_entrega;

-- 2) Storage: boletos — add tenant isolation via path prefix (empresa_id/...)
DROP POLICY IF EXISTS "Staff can view boletos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload boletos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete boletos" ON storage.objects;

CREATE POLICY "Staff can view boletos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'boletos'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'operacional'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Staff can upload boletos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'boletos'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'operacional'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Staff can update boletos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'boletos'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'boletos'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Staff can delete boletos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'boletos'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

-- 3) Storage: documentos-empresa — add tenant isolation
DROP POLICY IF EXISTS "Staff can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Gestor can delete documents" ON storage.objects;

CREATE POLICY "Staff can view documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documentos-empresa'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'operacional'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Staff can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documentos-empresa'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Staff can update documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documentos-empresa'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'documentos-empresa'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Admin/Gestor can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documentos-empresa'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

-- 4) Storage: documentos-contabeis — add tenant isolation and missing UPDATE
DROP POLICY IF EXISTS "staff_select_contabeis" ON storage.objects;
DROP POLICY IF EXISTS "staff_upload_contabeis" ON storage.objects;
DROP POLICY IF EXISTS "staff_delete_contabeis" ON storage.objects;

CREATE POLICY "staff_select_contabeis"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documentos-contabeis'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'operacional'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "staff_upload_contabeis"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documentos-contabeis'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "staff_update_contabeis"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documentos-contabeis'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'documentos-contabeis'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "staff_delete_contabeis"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documentos-contabeis'
  AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);
