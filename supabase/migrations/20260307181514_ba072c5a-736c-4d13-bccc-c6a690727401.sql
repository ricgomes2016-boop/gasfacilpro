ALTER TABLE public.integracoes_whatsapp 
ADD COLUMN IF NOT EXISTS provedor text NOT NULL DEFAULT 'zapi';