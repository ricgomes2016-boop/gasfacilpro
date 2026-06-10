
DROP POLICY IF EXISTS "Admin and gestor can manage visual configs" ON public.configuracoes_visuais;
CREATE POLICY "Admin and gestor can manage visual configs"
ON public.configuracoes_visuais
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role));

CREATE POLICY "Authenticated staff can read visual configs of own empresa"
ON public.configuracoes_visuais
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR unidade_id IS NULL
  OR public.unidade_belongs_to_user_empresa(unidade_id)
);

CREATE POLICY "Staff can read addresses of empresa clients"
ON public.cliente_enderecos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
      OR public.has_role(auth.uid(), 'operacional'::public.app_role)
      OR public.has_role(auth.uid(), 'entregador'::public.app_role)
    )
    AND cliente_id IN (
      SELECT c.id FROM public.clientes c WHERE c.empresa_id = public.get_user_empresa_id()
    )
  )
);

DROP POLICY IF EXISTS "Vehicle photos are publicly accessible" ON storage.objects;
CREATE POLICY "vehicle_photos_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
    OR public.has_role(auth.uid(), 'entregador'::public.app_role)
  )
);
