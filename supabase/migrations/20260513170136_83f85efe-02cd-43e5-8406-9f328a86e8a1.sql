CREATE POLICY "Operadores criam conversas WhatsApp da plataforma"
ON public.ai_conversas
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'operacional'::app_role)
  )
);