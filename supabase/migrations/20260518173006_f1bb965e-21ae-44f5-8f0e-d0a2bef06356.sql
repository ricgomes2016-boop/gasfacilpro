
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-avatars', 'whatsapp-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'whatsapp-avatars public read'
  ) THEN
    CREATE POLICY "whatsapp-avatars public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'whatsapp-avatars');
  END IF;
END $$;
