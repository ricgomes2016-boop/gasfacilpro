-- Configuração da API Oficial Meta (WhatsApp Cloud API) para Central Gás Matriz
-- Phone Number: +55 43 99807-0028
-- Phone Number ID: 935310426342230
-- WhatsApp Business Account ID: 2512580879177377
-- System User: Gasfacilpro Bot (ID: 61582206536907)
-- Token: Permanente (nunca expira)
-- Webhook URL: https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-webhook
-- Verify Token: gasfacil_meta_verify

BEGIN;

-- Adiciona colunas meta_ caso ainda não existam
ALTER TABLE public.integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_waba_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT;

-- Upsert da integração via Meta para a Central Gás Matriz
INSERT INTO public.integracoes_whatsapp (
  unidade_id,
  instance_id,
  token,
  base_url,
  provedor,
  ativo,
  meta_phone_number_id,
  meta_waba_id,
  meta_verify_token,
  meta_access_token,
  desconto_etapa1,
  desconto_etapa2,
  preco_minimo_p13
)
VALUES (
  'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614',
  '935310426342230',
  'EAAU1lGElzwwBREp8w66p7J9ZBZCCFQOFQZAmQD3ZBrxFY8LHZCX9FBNKQuFS8MavEUBoZCiKE0aWqxC868zbPzjFDQTq2VC0k0MqkS8ipTo5aTlrEE6UiYrhU3YLrzEJqZBj15lFfYvqOZARI9t8gls2ecmf4zuOIdyyooWZAao2DZCgC4fUjgLcVTaMZBB3dUUtIhrowZDZD',
  'https://graph.facebook.com',
  'meta',
  true,
  '935310426342230',
  '2512580879177377',
  'gasfacil_meta_verify',
  'EAAU1lGElzwwBREp8w66p7J9ZBZCCFQOFQZAmQD3ZBrxFY8LHZCX9FBNKQuFS8MavEUBoZCiKE0aWqxC868zbPzjFDQTq2VC0k0MqkS8ipTo5aTlrEE6UiYrhU3YLrzEJqZBj15lFfYvqOZARI9t8gls2ecmf4zuOIdyyooWZAao2DZCgC4fUjgLcVTaMZBB3dUUtIhrowZDZD',
  5.00,
  10.00,
  115.00
)
ON CONFLICT (unidade_id)
DO UPDATE SET
  instance_id           = EXCLUDED.instance_id,
  token                 = EXCLUDED.token,
  base_url              = EXCLUDED.base_url,
  provedor              = EXCLUDED.provedor,
  ativo                 = EXCLUDED.ativo,
  meta_phone_number_id  = EXCLUDED.meta_phone_number_id,
  meta_waba_id          = EXCLUDED.meta_waba_id,
  meta_verify_token     = EXCLUDED.meta_verify_token,
  meta_access_token     = EXCLUDED.meta_access_token;

COMMIT;
