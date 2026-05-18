ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS asaas_charge_id text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS linha_digitavel text,
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS nosso_numero text,
  ADD COLUMN IF NOT EXISTS pix_qrcode text,
  ADD COLUMN IF NOT EXISTS pix_copia_cola text;

CREATE INDEX IF NOT EXISTS idx_contas_receber_asaas_charge ON public.contas_receber(asaas_charge_id) WHERE asaas_charge_id IS NOT NULL;