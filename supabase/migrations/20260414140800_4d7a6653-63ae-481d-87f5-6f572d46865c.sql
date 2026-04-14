
-- Drop the restrictive insert policy and replace with one that allows base (unidade) sends
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_mensagens;

CREATE POLICY "Users can insert own chat messages" ON public.chat_mensagens
FOR INSERT TO authenticated
WITH CHECK (
  remetente_id = auth.uid()
  OR remetente_id IN (SELECT e.id FROM entregadores e WHERE e.user_id = auth.uid())
  OR (
    remetente_tipo = 'base'
    AND remetente_id IN (
      SELECT u.id FROM unidades u WHERE u.empresa_id = public.get_user_empresa_id()
    )
  )
);
