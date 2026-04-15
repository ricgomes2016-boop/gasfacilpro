-- Drop overly permissive policies on notificacoes_status_pedido
DROP POLICY IF EXISTS "Authenticated users can view notifications" ON public.notificacoes_status_pedido;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notificacoes_status_pedido;

-- Tenant-scoped SELECT: user can only see notifications for pedidos in their empresa
CREATE POLICY "Users can view own empresa notifications"
ON public.notificacoes_status_pedido
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.unidades u ON u.id = p.unidade_id
    WHERE p.id = notificacoes_status_pedido.pedido_id
      AND u.empresa_id = public.get_user_empresa_id()
  )
);

-- INSERT: only staff roles can manually insert (trigger fn_notif_status_pedido is SECURITY DEFINER so bypasses RLS)
CREATE POLICY "Staff can insert notifications"
ON public.notificacoes_status_pedido
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'operacional'::app_role)
);

-- UPDATE: only staff in same empresa can mark as sent
CREATE POLICY "Staff can update own empresa notifications"
ON public.notificacoes_status_pedido
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role)
   OR public.has_role(auth.uid(), 'gestor'::app_role)
   OR public.has_role(auth.uid(), 'operacional'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.unidades u ON u.id = p.unidade_id
    WHERE p.id = notificacoes_status_pedido.pedido_id
      AND u.empresa_id = public.get_user_empresa_id()
  )
);