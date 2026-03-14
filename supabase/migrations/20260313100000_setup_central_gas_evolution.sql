-- Atualização da Evolution API para Central Gás Matriz (IDs Reais)
UPDATE public.integracoes_whatsapp 
SET 
  base_url = 'http://187.77.52.241:8000',
  token = 'gasfacilpro2026', -- Token atualizado conforme VPS
  provedor = 'evolution',
  ativo = true
WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614';

-- Caso não exista (garantir), inserir com o ID correto
INSERT INTO public.integracoes_whatsapp (
  unidade_id, 
  instance_id, 
  token, 
  base_url, 
  provedor, 
  ativo
) 
SELECT 
  'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614', 
  'centralgas_matriz', 
  'gasfacilpro2026', 
  'http://187.77.52.241:8000', 
  'evolution', 
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.integracoes_whatsapp WHERE unidade_id = 'aa5b7c93-4fe6-4dba-a0b5-2af43cd20614'
);
