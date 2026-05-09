-- Atualização das credenciais da API Oficial Meta (WhatsApp Cloud API) para Central Gás
-- Data: 09/05/2026
-- NÚMERO: +55 43 3524-1094
-- Phone Number ID (NOVO): 108521384467824(8)
-- WhatsApp Business Account ID (WABA - NOVO): 216631787412137(9)
-- App ID: 1466286284853004
-- Token: Temporário (gerado via developers.facebook.com)
-- Webhook URL: https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-webhook
-- Verify Token: gasfacil_meta_verify

BEGIN;

-- Atualizar integração da Central Gás com novo token e Phone Number ID
UPDATE public.integracoes_whatsapp SET
  instance_id          = 'meta_108521384467824',
  token                = 'EAAU1lGElzwwBRTZBILQikSOChaGhxkUU7SlCelj68DYyMqHCCyYwestHS3D1FUBYNpdL89Cd2B2fClS9IZBo6kup6pi60IZB1F0NrJ5MUwOCGjZCkRWaiA8duEaEYfV7ZCnqZBFizzJh0N9h4lWDVH0ZBB8s7DkYTsZCG7jOlzLT4wLDtmTW5Mpmcvt7w4h9B5JpUAmCsU5Ctxvg5etfA9DwgZAuIkzxpofZCAxzf80bjisaVGtaJ1V5kZBmnpygiWQBB4BVMxOnHDo9iucyIXvEPc9s1a7',
  base_url             = 'https://graph.facebook.com',
  provedor             = 'meta',
  ativo                = true,
  status_conexao       = 'conectado',
  numero_telefone      = '+55 43 3524 1094',
  meta_phone_number_id = '108521384467824',
  meta_waba_id         = '216631787412137',
  meta_verify_token    = 'gasfacil_meta_verify',
  meta_access_token    = 'EAAU1lGElzwwBRTZBILQikSOChaGhxkUU7SlCelj68DYyMqHCCyYwestHS3D1FUBYNpdL89Cd2B2fClS9IZBo6kup6pi60IZB1F0NrJ5MUwOCGjZCkRWaiA8duEaEYfV7ZCnqZBFizzJh0N9h4lWDVH0ZBB8s7DkYTsZCG7jOlzLT4wLDtmTW5Mpmcvt7w4h9B5JpUAmCsU5Ctxvg5etfA9DwgZAuIkzxpofZCAxzf80bjisaVGtaJ1V5kZBmnpygiWQBB4BVMxOnHDo9iucyIXvEPc9s1a7',
  updated_at           = now()
WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614'
  AND provedor = 'meta';

-- Caso não exista (fallback), inserir nova integração
INSERT INTO public.integracoes_whatsapp (
  unidade_id,
  instance_id,
  token,
  base_url,
  provedor,
  ativo,
  status_conexao,
  numero_telefone,
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
  'meta_108521384467824',
  'EAAU1lGElzwwBRTZBILQikSOChaGhxkUU7SlCelj68DYyMqHCCyYwestHS3D1FUBYNpdL89Cd2B2fClS9IZBo6kup6pi60IZB1F0NrJ5MUwOCGjZCkRWaiA8duEaEYfV7ZCnqZBFizzJh0N9h4lWDVH0ZBB8s7DkYTsZCG7jOlzLT4wLDtmTW5Mpmcvt7w4h9B5JpUAmCsU5Ctxvg5etfA9DwgZAuIkzxpofZCAxzf80bjisaVGtaJ1V5kZBmnpygiWQBB4BVMxOnHDo9iucyIXvEPc9s1a7',
  'https://graph.facebook.com',
  'meta',
  true,
  'conectado',
  '+55 43 3524 1094',
  '108521384467824',
  '216631787412137',
  'gasfacil_meta_verify',
  'EAAU1lGElzwwBRTZBILQikSOChaGhxkUU7SlCelj68DYyMqHCCyYwestHS3D1FUBYNpdL89Cd2B2fClS9IZBo6kup6pi60IZB1F0NrJ5MUwOCGjZCkRWaiA8duEaEYfV7ZCnqZBFizzJh0N9h4lWDVH0ZBB8s7DkYTsZCG7jOlzLT4wLDtmTW5Mpmcvt7w4h9B5JpUAmCsU5Ctxvg5etfA9DwgZAuIkzxpofZCAxzf80bjisaVGtaJ1V5kZBmnpygiWQBB4BVMxOnHDo9iucyIXvEPc9s1a7',
  5.00,
  10.00,
  115.00
WHERE NOT EXISTS (
  SELECT 1 FROM public.integracoes_whatsapp
  WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614'
    AND provedor = 'meta'
);

COMMIT;
