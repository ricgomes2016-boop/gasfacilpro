ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS asaas_webhook_token text;

CREATE INDEX IF NOT EXISTS idx_contas_receber_asaas_charge_id
  ON public.contas_receber (asaas_charge_id)
  WHERE asaas_charge_id IS NOT NULL;