-- Refinamento da configuração Evolution API - Central Gás Matriz
-- Garante que o provedor, URL e IDs estão corretos e consistentes

BEGIN;

-- 1. Upsert na tabela integracoes_whatsapp para Central Gás Matriz
INSERT INTO public.integracoes_whatsapp (
  unidade_id, 
  instance_id, 
  token, 
  base_url, 
  provedor, 
  ativo,
  desconto_etapa1,
  desconto_etapa2,
  preco_minimo_p13
) 
VALUES (
  'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614', -- ID da Central Gás Matriz
  'centralgas_matriz', 
  'gasfacilpro2026', 
  'http://187.77.52.241:8080', 
  'evolution', 
  true,
  5.00,
  10.00,
  115.00
)
ON CONFLICT (unidade_id) 
DO UPDATE SET 
  instance_id = EXCLUDED.instance_id,
  token = EXCLUDED.token,
  base_url = EXCLUDED.base_url,
  provedor = EXCLUDED.provedor,
  ativo = EXCLUDED.ativo,
  desconto_etapa1 = EXCLUDED.desconto_etapa1,
  desconto_etapa2 = EXCLUDED.desconto_etapa2,
  preco_minimo_p13 = EXCLUDED.preco_minimo_p13;

COMMIT;
