-- 1. Foto de perfil do cliente nas conversas
ALTER TABLE public.ai_conversas
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em timestamptz;

-- 2. Foto de perfil da loja na integração WhatsApp
ALTER TABLE public.integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS loja_foto_url text,
  ADD COLUMN IF NOT EXISTS loja_foto_atualizada_em timestamptz;

-- 3. Bucket privado para anexos do chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-anexos', 'chat-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Path layout: {empresa_id}/{conversa_id}/{filename}
-- Política: usuários autenticados da mesma empresa podem ler/escrever
CREATE POLICY "Chat anexos - select same empresa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-anexos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  )
);

CREATE POLICY "Chat anexos - insert same empresa"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-anexos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  )
);

CREATE POLICY "Chat anexos - update same empresa"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-anexos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  )
);

CREATE POLICY "Chat anexos - delete same empresa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-anexos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  )
);