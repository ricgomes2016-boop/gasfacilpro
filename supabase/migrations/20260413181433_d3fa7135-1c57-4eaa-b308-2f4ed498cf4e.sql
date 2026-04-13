
-- Drop the restrictive insert policies
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_mensagens;
DROP POLICY IF EXISTS "tenant_isolation_chat_mensagens" ON public.chat_mensagens;

-- Recreate tenant isolation for SELECT/UPDATE/DELETE
CREATE POLICY "tenant_isolation_chat_mensagens" ON public.chat_mensagens
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR remetente_id = auth.uid()
  OR destinatario_id = auth.uid()
  OR remetente_id IN (SELECT profiles.user_id FROM profiles WHERE profiles.empresa_id = get_user_empresa_id())
  OR remetente_id IN (SELECT e.id FROM entregadores e JOIN unidades u ON e.unidade_id = u.id WHERE u.empresa_id = get_user_empresa_id())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR remetente_id = auth.uid()
  OR remetente_id IN (SELECT e.id FROM entregadores e WHERE e.user_id = auth.uid())
);

-- Allow users to insert messages where remetente_id is their uid OR their linked entregador
CREATE POLICY "Users can insert own chat messages" ON public.chat_mensagens
FOR INSERT
WITH CHECK (
  remetente_id = auth.uid()
  OR remetente_id IN (SELECT e.id FROM entregadores e WHERE e.user_id = auth.uid())
);
