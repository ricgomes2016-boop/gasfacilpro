DROP POLICY IF EXISTS "Staff can view clientes of their empresa" ON public.clientes;
DROP POLICY IF EXISTS "Staff can insert clientes in their empresa" ON public.clientes;
DROP POLICY IF EXISTS "Staff can update clientes of their empresa" ON public.clientes;
DROP POLICY IF EXISTS "Staff can delete clientes of their empresa" ON public.clientes;

DROP POLICY IF EXISTS "Entregador visualiza operadoras_cartao" ON public.operadoras_cartao;
DROP POLICY IF EXISTS "Entregador visualiza operadoras da sua unidade" ON public.operadoras_cartao;

CREATE POLICY "Entregador visualiza operadoras da sua unidade"
ON public.operadoras_cartao
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'entregador'::app_role)
  AND ativo = true
  AND unidade_id IS NOT NULL
  AND unidade_id IN (SELECT uu.unidade_id FROM public.user_unidades uu WHERE uu.user_id = auth.uid())
);

DROP POLICY IF EXISTS "tenant_isolation_whatsapp_gateway_instances" ON public.whatsapp_gateway_instances;

CREATE POLICY "tenant_isolation_whatsapp_gateway_instances"
ON public.whatsapp_gateway_instances
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id())
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id());