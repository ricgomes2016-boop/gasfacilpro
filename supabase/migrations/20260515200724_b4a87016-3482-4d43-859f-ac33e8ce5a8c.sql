ALTER TABLE public.licitacoes
ADD COLUMN IF NOT EXISTS dados_anexos JSONB NOT NULL DEFAULT '{}'::jsonb;