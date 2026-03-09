ALTER TABLE public.integracoes_whatsapp 
ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS meta_verify_token TEXT;