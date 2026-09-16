ALTER TABLE public.vale_gas_lotes
  ADD COLUMN IF NOT EXISTS numero_empenho text;

ALTER TABLE public.vale_gas
  ADD COLUMN IF NOT EXISTS numero_empenho text;

ALTER TABLE public.vale_gas_lotes
  DROP CONSTRAINT IF EXISTS vale_gas_lotes_numero_empenho_preenchido;
ALTER TABLE public.vale_gas_lotes
  ADD CONSTRAINT vale_gas_lotes_numero_empenho_preenchido
  CHECK (numero_empenho IS NULL OR btrim(numero_empenho) <> '');

ALTER TABLE public.vale_gas
  DROP CONSTRAINT IF EXISTS vale_gas_numero_empenho_preenchido;
ALTER TABLE public.vale_gas
  ADD CONSTRAINT vale_gas_numero_empenho_preenchido
  CHECK (numero_empenho IS NULL OR btrim(numero_empenho) <> '');

COMMENT ON COLUMN public.vale_gas_lotes.numero_empenho IS
  'Número do empenho informado na emissão de lotes para parceiros do tipo empenho.';
COMMENT ON COLUMN public.vale_gas.numero_empenho IS
  'Cópia do número do empenho do lote para impressão e rastreabilidade do vale.';

-- Atualização retroativa solicitada para os lotes emitidos em 16/09/2026
-- ao Fundo Municipal de Assistência Social. O recorte inclui parceiro, tipo e
-- data local para não atingir lotes de outras instituições ou outros dias.
UPDATE public.vale_gas_lotes AS lote
SET numero_empenho = '7082/2026'
FROM public.vale_gas_parceiros AS parceiro
WHERE parceiro.id = lote.parceiro_id
  AND parceiro.tipo = 'empenho'
  AND parceiro.nome ILIKE '%FUNDO MUNICIPAL%ASSIST_NCIA SOCIAL%'
  AND (lote.created_at AT TIME ZONE 'America/Sao_Paulo')::date = DATE '2026-09-16'
  AND lote.numero_empenho IS DISTINCT FROM '7082/2026';

UPDATE public.vale_gas AS vale
SET numero_empenho = lote.numero_empenho
FROM public.vale_gas_lotes AS lote
WHERE lote.id = vale.lote_id
  AND lote.numero_empenho = '7082/2026'
  AND vale.numero_empenho IS DISTINCT FROM lote.numero_empenho;