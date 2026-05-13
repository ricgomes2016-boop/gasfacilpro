
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS foto_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Vehicle photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Authenticated users can upload vehicle photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "Authenticated users can update vehicle photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Authenticated users can delete vehicle photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicle-photos');
