ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS asaas_api_key TEXT,
  ADD COLUMN IF NOT EXISTS asaas_sandbox BOOLEAN DEFAULT true;