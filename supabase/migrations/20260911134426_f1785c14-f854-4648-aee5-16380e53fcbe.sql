CREATE POLICY "clientes_apenas_proprio_cadastro_restrictive"
ON public.clientes
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'financeiro')
  OR public.has_role(auth.uid(), 'operacional')
  OR public.has_role(auth.uid(), 'vendedor')
  OR public.has_role(auth.uid(), 'entregador')
  OR public.has_role(auth.uid(), 'contador')
  OR public.has_role(auth.uid(), 'transportadora')
  OR public.has_role(auth.uid(), 'parceiro')
  OR public.has_role(auth.uid(), 'super_admin')
  OR clientes.user_id = auth.uid()
);