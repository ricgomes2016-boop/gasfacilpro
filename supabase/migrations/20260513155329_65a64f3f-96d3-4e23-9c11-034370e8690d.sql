-- Permitir que operadores (admin/gestor/operacional) vejam e atualizem
-- as conversas de WhatsApp/IA da plataforma (user_id sentinela 00000000...)
-- e suas mensagens, para que apareçam na Caixa de Entrada do Atendimento.

CREATE POLICY "Operadores veem conversas WhatsApp da plataforma"
ON public.ai_conversas
FOR SELECT
TO authenticated
USING (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);

CREATE POLICY "Operadores atualizam conversas WhatsApp da plataforma"
ON public.ai_conversas
FOR UPDATE
TO authenticated
USING (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);

-- Mensagens das conversas da plataforma
CREATE POLICY "Operadores veem mensagens WhatsApp da plataforma"
ON public.ai_mensagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.user_id = '00000000-0000-0000-0000-000000000000'::uuid
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);

CREATE POLICY "Operadores inserem mensagens WhatsApp da plataforma"
ON public.ai_mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.user_id = '00000000-0000-0000-0000-000000000000'::uuid
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);