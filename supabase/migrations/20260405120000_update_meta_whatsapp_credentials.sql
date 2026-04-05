-- Atualização das credenciais da API Oficial Meta (WhatsApp Cloud API) para Central Gás
-- Data: 05/04/2026
-- Número: +55 43 9807-0028
-- Phone Number ID: 1025260084009234
-- WhatsApp Business Account ID (WABA): 898649429546834
-- App ID: 1695439258558329
-- App Name: GasFacilPro
-- System User: Gasfacilpro (ID: 122094571424776757)
-- Token: Permanente (System User Token - nunca expira)
-- Webhook URL: https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-webhook
-- Verify Token: gasfacil_meta_verify

BEGIN;

-- Garantir que as colunas meta_ existam
ALTER TABLE public.integracoes_whatsapp
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_waba_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT;

-- Atualizar integração da Central Gás Matriz com novas credenciais
UPDATE public.integracoes_whatsapp SET
  instance_id          = '1025260084009234',
  token                = 'EAAYFZCjaZBn3kBRKtuGi69SfwkdUETZBbSB7EmbA2owJG25lZCFkp4hiwIpcebuEFpZCLycFWpsbGOq9YZBCZA3ZAfgp5gnV0ZA0bwRCItfMZCiE7RBDSt6Tz56XUbUz0ZCqEZCaOzyQa0JrrjBlhdGvMzWHyVfJ7XsCoTxn2eGLDhhUXoDk4Xw2F0xcsm4wqHaBl7EU0gZDZD',
  base_url             = 'https://graph.facebook.com',
  provedor             = 'meta',
  ativo                = true,
  meta_phone_number_id = '1025260084009234',
  meta_waba_id         = '898649429546834',
  meta_verify_token    = 'gasfacil_meta_verify',
  meta_access_token    = 'EAAYFZCjaZBn3kBRKtuGi69SfwkdUETZBbSB7EmbA2owJG25lZCFkp4hiwIpcebuEFpZCLycFWpsbGOq9YZBCZA3ZAfgp5gnV0ZA0bwRCItfMZCiE7RBDSt6Tz56XUbUz0ZCqEZCaOzyQa0JrrjBlhdGvMzWHyVfJ7XsCoTxn2eGLDhhUXoDk4Xw2F0xcsm4wqHaBl7EU0gZDZD',
  updated_at           = now()
WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614'
  AND provedor = 'meta';

-- Caso não exista ainda, inserir
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
SELECT
  'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614',
  '1025260084009234',
  'EAAYFZCjaZBn3kBRKtuGi69SfwkdUETZBbSB7EmbA2owJG25lZCFkp4hiwIpcebuEFpZCLycFWpsbGOq9YZBCZA3ZAfgp5gnV0ZA0bwRCItfMZCiE7RBDSt6Tz56XUbUz0ZCqEZCaOzyQa0JrrjBlhdGvMzWHyVfJ7XsCoTxn2eGLDhhUXoDk4Xw2F0xcsm4wqHaBl7EU0gZDZD',
  'https://graph.facebook.com',
  'meta',
  true,
  '1025260084009234',
  '898649429546834',
  'gasfacil_meta_verify',
  'EAAYFZCjaZBn3kBRKtuGi69SfwkdUETZBbSB7EmbA2owJG25lZCFkp4hiwIpcebuEFpZCLycFWpsbGOq9YZBCZA3ZAfgp5gnV0ZA0bwRCItfMZCiE7RBDSt6Tz56XUbUz0ZCqEZCaOzyQa0JrrjBlhdGvMzWHyVfJ7XsCoTxn2eGLDhhUXoDk4Xw2F0xcsm4wqHaBl7EU0gZDZD',
  5.00,
  10.00,
  115.00
WHERE NOT EXISTS (
  SELECT 1 FROM public.integracoes_whatsapp
  WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614'
);

COMMIT;
