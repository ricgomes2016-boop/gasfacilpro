DROP POLICY IF EXISTS vehicle_photos_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS vehicle_photos_admin_insert ON storage.objects;
DROP POLICY IF EXISTS vehicle_photos_admin_update ON storage.objects;
DROP POLICY IF EXISTS vehicle_photos_admin_delete ON storage.objects;

CREATE OR REPLACE FUNCTION public.vehicle_photo_belongs_to_empresa(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.veiculos v
    JOIN public.unidades u ON u.id = v.unidade_id
    WHERE u.empresa_id = public.get_user_empresa_id()
      AND (
        v.foto_url LIKE '%' || _object_name
        OR v.foto_painel LIKE '%' || _object_name
        OR v.foto_frente LIKE '%' || _object_name
        OR v.foto_lado_direito LIKE '%' || _object_name
        OR v.foto_lado_esquerdo LIKE '%' || _object_name
        OR v.foto_traseira LIKE '%' || _object_name
      )
  )
$$;

CREATE POLICY vehicle_photos_tenant_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND (
    (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    OR public.vehicle_photo_belongs_to_empresa(name)
  )
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'operacional'::app_role)
    OR has_role(auth.uid(), 'entregador'::app_role)
  )
);

CREATE POLICY vehicle_photos_tenant_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'operacional'::app_role)
  )
);

CREATE POLICY vehicle_photos_tenant_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND (
    (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    OR public.vehicle_photo_belongs_to_empresa(name)
  )
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
)
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY vehicle_photos_tenant_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND (
    (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    OR public.vehicle_photo_belongs_to_empresa(name)
  )
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);