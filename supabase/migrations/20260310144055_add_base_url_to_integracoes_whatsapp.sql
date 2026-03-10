-- Migration para adicionar a URL base da Evolution API
ALTER TABLE integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Comentário explicativo na coluna
COMMENT ON COLUMN integracoes_whatsapp.base_url IS 'URL base do servidor self-hosted (ex: Evolution API) ou endpoint de disparo direto';
