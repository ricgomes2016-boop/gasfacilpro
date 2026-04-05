
-- Add new columns to integracoes_whatsapp for multi-provider config
ALTER TABLE public.integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS provedor_tipo text DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS instancia_nome text,
  ADD COLUMN IF NOT EXISTS instancia_url text,
  ADD COLUMN IF NOT EXISTS instancia_token text,
  ADD COLUMN IF NOT EXISTS numero_telefone text,
  ADD COLUMN IF NOT EXISTS status_conexao text DEFAULT 'desconectado',
  ADD COLUMN IF NOT EXISTS ultima_verificacao timestamptz,
  ADD COLUMN IF NOT EXISTS qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS qr_code_expira_em timestamptz;
