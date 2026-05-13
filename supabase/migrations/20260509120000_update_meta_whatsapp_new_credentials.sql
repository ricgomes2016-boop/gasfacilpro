-- Atualização das credenciais da API Oficial Meta (WhatsApp Cloud API) para Central Gás
-- Data: 09/05/2026
-- NÚMERO: +55 43 3524-1094
-- Phone Number ID (CORRETO): 1085213844678248
-- WhatsApp Business Account ID (WABA - CORRETO): 2166317874121379
-- App ID: 1466286284853004
-- Token: PERMANENTE (System User 'Gasfacilpro Bot' - ID: 61582206536907 - Nunca expira)
-- Webhook URL: https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-webhook
-- Verify Token: gasfacil_meta_verify

BEGIN;

-- Atualizar integração da Central Gás com novo token e Phone Number ID
UPDATE public.integracoes_whatsapp SET
  instance_id          = 'meta_1085213844678248',
  token                = 'EAAU1lGElzwwBRWq5yN6Ewmg1FYqTtKy43hSyGElCSJfsDcTq2hvRPpQYMWQoFl4GjrVTS2xLhdRPsAa6vcja1mDer4LJGLJxkmeG6hZA5uRkpGr2BIZCScOzRCyRWrcgCIHy1ZCKuwrslzWrlmKa22czbbLjenraiYjxeFp2jJz7ZAtpDpQ99KTqykwZBhGVaCwZDZD',
  base_url             = 'https://graph.facebook.com',
  provedor             = 'meta',
  ativo                = true,
  status_conexao       = 'conectado',
  numero_telefone      = '+55 43 3524 1094',
  meta_phone_number_id = '1085213844678248',
  meta_waba_id         = '2166317874121379',
  meta_verify_token    = 'gasfacil_meta_verify',
  meta_access_token    = 'EAAU1lGElzwwBRWq5yN6Ewmg1FYqTtKy43hSyGElCSJfsDcTq2hvRPpQYMWQoFl4GjrVTS2xLhdRPsAa6vcja1mDer4LJGLJxkmeG6hZA5uRkpGr2BIZCScOzRCyRWrcgCIHy1ZCKuwrslzWrlmKa22czbbLjenraiYjxeFp2jJz7ZAtpDpQ99KTqykwZBhGVaCwZDZD',
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
  'meta_1085213844678248',
  'EAAU1lGElzwwBRWq5yN6Ewmg1FYqTtKy43hSyGElCSJfsDcTq2hvRPpQYMWQoFl4GjrVTS2xLhdRPsAa6vcja1mDer4LJGLJxkmeG6hZA5uRkpGr2BIZCScOzRCyRWrcgCIHy1ZCKuwrslzWrlmKa22czbbLjenraiYjxeFp2jJz7ZAtpDpQ99KTqykwZBhGVaCwZDZD',
  'https://graph.facebook.com',
  'meta',
  true,
  'conectado',
  '+55 43 3524 1094',
  '1085213844678248',
  '2166317874121379',
  'gasfacil_meta_verify',
  'EAAU1lGElzwwBRWq5yN6Ewmg1FYqTtKy43hSyGElCSJfsDcTq2hvRPpQYMWQoFl4GjrVTS2xLhdRPsAa6vcja1mDer4LJGLJxkmeG6hZA5uRkpGr2BIZCScOzRCyRWrcgCIHy1ZCKuwrslzWrlmKa22czbbLjenraiYjxeFp2jJz7ZAtpDpQ99KTqykwZBhGVaCwZDZD',
  5.00,
  10.00,
  115.00
WHERE NOT EXISTS (
  SELECT 1 FROM public.integracoes_whatsapp
  WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614'
    AND provedor = 'meta'
);

COMMIT;
