ALTER TABLE public.chamadas_recebidas ADD COLUMN IF NOT EXISTS did text;
CREATE INDEX IF NOT EXISTS idx_chamadas_did ON public.chamadas_recebidas(did);