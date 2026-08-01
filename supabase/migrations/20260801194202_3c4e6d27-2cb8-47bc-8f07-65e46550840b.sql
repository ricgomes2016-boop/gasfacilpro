DROP POLICY IF EXISTS clientes_unidade_scope ON public.clientes;

CREATE POLICY clientes_unidade_scope
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR NOT EXISTS (SELECT 1 FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cliente_unidades cu
      JOIN public.user_unidades uu ON uu.unidade_id = cu.unidade_id
      WHERE cu.cliente_id = clientes.id AND uu.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR NOT EXISTS (SELECT 1 FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cliente_unidades cu
      JOIN public.user_unidades uu ON uu.unidade_id = cu.unidade_id
      WHERE cu.cliente_id = clientes.id AND uu.user_id = auth.uid()
    )
  )
);