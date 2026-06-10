
-- 1) Restrictive tenant isolation on comprovantes_entrega
CREATE POLICY comprovantes_tenant_isolation
ON public.comprovantes_entrega
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
  OR EXISTS (
    SELECT 1 FROM public.entregadores e
    WHERE e.id = comprovantes_entrega.entregador_id
      AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
  OR EXISTS (
    SELECT 1 FROM public.entregadores e
    WHERE e.id = comprovantes_entrega.entregador_id
      AND e.user_id = auth.uid()
  )
);

-- 2) Bind private-bucket storage policies to authenticated role
ALTER POLICY "Authenticated users can upload product images" ON storage.objects TO authenticated;
ALTER POLICY "Staff can update product images" ON storage.objects TO authenticated;
ALTER POLICY "Staff can delete product images" ON storage.objects TO authenticated;

ALTER POLICY "Users can upload own avatar" ON storage.objects TO authenticated;
ALTER POLICY "Users can update own avatar" ON storage.objects TO authenticated;
ALTER POLICY "Users can delete own avatar" ON storage.objects TO authenticated;

ALTER POLICY "Certificados: gestores atualizam da própria empresa" ON storage.objects TO authenticated;
ALTER POLICY "Certificados: gestores leem da própria empresa" ON storage.objects TO authenticated;
ALTER POLICY "Certificados: gestores enviam para a própria empresa" ON storage.objects TO authenticated;
ALTER POLICY "Certificados: gestores apagam da própria empresa" ON storage.objects TO authenticated;

ALTER POLICY "Staff can view boletos" ON storage.objects TO authenticated;
ALTER POLICY "Staff can upload boletos" ON storage.objects TO authenticated;
ALTER POLICY "Staff can update boletos" ON storage.objects TO authenticated;
ALTER POLICY "Staff can delete boletos" ON storage.objects TO authenticated;

ALTER POLICY "Staff can view documents" ON storage.objects TO authenticated;
ALTER POLICY "Staff can upload documents" ON storage.objects TO authenticated;
ALTER POLICY "Staff can update documents" ON storage.objects TO authenticated;
ALTER POLICY "Admin/Gestor can delete documents" ON storage.objects TO authenticated;

ALTER POLICY staff_select_contabeis ON storage.objects TO authenticated;
ALTER POLICY staff_upload_contabeis ON storage.objects TO authenticated;
ALTER POLICY staff_update_contabeis ON storage.objects TO authenticated;
ALTER POLICY staff_delete_contabeis ON storage.objects TO authenticated;
