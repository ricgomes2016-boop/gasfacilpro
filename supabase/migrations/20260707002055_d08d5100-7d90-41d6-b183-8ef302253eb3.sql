
-- 1) contratos_recorrentes: usar get_current_user_cliente_ids() em vez de match por telefone
DROP POLICY IF EXISTS clientes_veem_seus_contratos ON public.contratos_recorrentes;
CREATE POLICY clientes_veem_seus_contratos
ON public.contratos_recorrentes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'operacional'::app_role)
  OR (
    has_role(auth.uid(), 'cliente'::app_role)
    AND cliente_id IN (SELECT public.get_current_user_cliente_ids())
  )
);

DROP POLICY IF EXISTS clientes_atualizam_contratos ON public.contratos_recorrentes;
CREATE POLICY clientes_atualizam_contratos
ON public.contratos_recorrentes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'operacional'::app_role)
  OR (
    has_role(auth.uid(), 'cliente'::app_role)
    AND cliente_id IN (SELECT public.get_current_user_cliente_ids())
  )
);

-- 2) pedido_itens: cliente só insere itens em pedidos próprios
DROP POLICY IF EXISTS "Clientes podem inserir itens de pedido" ON public.pedido_itens;
CREATE POLICY "Clientes podem inserir itens de pedido"
ON public.pedido_itens
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_itens.pedido_id
      AND p.cliente_id IN (SELECT public.get_current_user_cliente_ids())
  )
);

-- 3) pedidos: cliente só cria pedidos para si
DROP POLICY IF EXISTS "Clientes podem criar pedidos" ON public.pedidos;
CREATE POLICY "Clientes podem criar pedidos"
ON public.pedidos
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND cliente_id IN (SELECT public.get_current_user_cliente_ids())
);

-- 4) whatsapp_eventos: inserção restrita ao service_role
DROP POLICY IF EXISTS "Service role insere eventos WhatsApp" ON public.whatsapp_eventos;
CREATE POLICY "Service role insere eventos WhatsApp"
ON public.whatsapp_eventos
FOR INSERT TO service_role
WITH CHECK (true);
