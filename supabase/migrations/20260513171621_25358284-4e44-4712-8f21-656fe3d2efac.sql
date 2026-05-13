DROP POLICY IF EXISTS "tenant_isolation_ai_conversas" ON public.ai_conversas;

CREATE POLICY "tenant_isolation_ai_conversas"
ON public.ai_conversas
AS RESTRICTIVE
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
      OR has_role(auth.uid(), 'operacional'::app_role)
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
      OR has_role(auth.uid(), 'operacional'::app_role)
    )
  )
);