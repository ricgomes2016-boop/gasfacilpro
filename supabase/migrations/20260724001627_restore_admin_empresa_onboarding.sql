-- Restore initial company onboarding for authenticated admins that are not
-- linked to any empresa yet. Super admins keep their existing broad insert path.
DROP POLICY IF EXISTS "Authenticated admin can create empresa" ON public.empresas;

CREATE POLICY "Authenticated admin can create empresa"
ON public.empresas
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.empresa_id IS NULL
    )
  )
);
