
-- 1) chat_mensagens: remove permissive universal-read policy and enforce tenant isolation via RESTRICTIVE policy
DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON public.chat_mensagens;

CREATE POLICY "chat_mensagens_tenant_restrict"
ON public.chat_mensagens
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (remetente_id = auth.uid())
  OR (destinatario_id = auth.uid())
  OR (remetente_id IN (SELECT p.user_id FROM public.profiles p WHERE p.empresa_id = public.get_user_empresa_id()))
  OR (destinatario_id IN (SELECT p.user_id FROM public.profiles p WHERE p.empresa_id = public.get_user_empresa_id()))
  OR (remetente_id IN (SELECT e.id FROM public.entregadores e JOIN public.unidades u ON u.id = e.unidade_id WHERE u.empresa_id = public.get_user_empresa_id()))
  OR (destinatario_id IN (SELECT e.id FROM public.entregadores e JOIN public.unidades u ON u.id = e.unidade_id WHERE u.empresa_id = public.get_user_empresa_id()))
  OR (remetente_id IN (SELECT u.id FROM public.unidades u WHERE u.empresa_id = public.get_user_empresa_id()))
  OR (destinatario_id IN (SELECT u.id FROM public.unidades u WHERE u.empresa_id = public.get_user_empresa_id()))
  OR (remetente_tipo = 'contador' AND public.has_role(auth.uid(), 'contador'::public.app_role))
  OR (destinatario_tipo = 'contador' AND public.has_role(auth.uid(), 'contador'::public.app_role))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (remetente_id = auth.uid())
  OR (remetente_id IN (SELECT e.id FROM public.entregadores e WHERE e.user_id = auth.uid()))
  OR (remetente_tipo = 'base' AND remetente_id IN (SELECT u.id FROM public.unidades u WHERE u.empresa_id = public.get_user_empresa_id()))
  OR (remetente_tipo = 'contador' AND public.has_role(auth.uid(), 'contador'::public.app_role))
);

-- 2) notificacoes_status_pedido: remove unrestricted INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notificacoes_status_pedido;

-- Replace with a tenant-scoped INSERT (staff policy already exists; this adds a safe path for any authenticated user creating notifications only for pedidos in their own empresa)
CREATE POLICY "Users can insert notifications for own empresa pedidos"
ON public.notificacoes_status_pedido
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pedidos p
    JOIN public.unidades u ON u.id = p.unidade_id
    WHERE p.id = notificacoes_status_pedido.pedido_id
      AND u.empresa_id = public.get_user_empresa_id()
  )
);
