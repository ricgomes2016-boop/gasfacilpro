
-- Create marketing-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload marketing assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'marketing-assets');

-- Allow public read
CREATE POLICY "Public read marketing assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'marketing-assets');

-- Allow owners to delete their uploads
CREATE POLICY "Users can delete own marketing assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'marketing-assets');
