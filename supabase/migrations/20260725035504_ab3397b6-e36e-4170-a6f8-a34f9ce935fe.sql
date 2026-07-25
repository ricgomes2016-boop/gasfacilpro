DROP POLICY IF EXISTS "clientes_criam_contratos" ON public.contratos_recorrentes;

CREATE POLICY "clientes_criam_contratos"
ON public.contratos_recorrentes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND cliente_id IN (SELECT get_current_user_cliente_ids())
);