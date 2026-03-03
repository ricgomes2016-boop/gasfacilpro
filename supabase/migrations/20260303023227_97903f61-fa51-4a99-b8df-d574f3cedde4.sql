-- Add transport and compliance columns to notas_fiscais
ALTER TABLE public.notas_fiscais 
  ADD COLUMN IF NOT EXISTS modalidade_frete text DEFAULT '0',
  ADD COLUMN IF NOT EXISTS transportadora_nome text,
  ADD COLUMN IF NOT EXISTS transportadora_cnpj text,
  ADD COLUMN IF NOT EXISTS transportadora_ie text,
  ADD COLUMN IF NOT EXISTS transportadora_endereco text,
  ADD COLUMN IF NOT EXISTS transportadora_cidade_uf text,
  ADD COLUMN IF NOT EXISTS peso_liquido numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_volumes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS especie_volumes text,
  ADD COLUMN IF NOT EXISTS marca_volumes text,
  ADD COLUMN IF NOT EXISTS numeracao_volumes text,
  ADD COLUMN IF NOT EXISTS info_complementares text,
  ADD COLUMN IF NOT EXISTS info_fisco text,
  ADD COLUMN IF NOT EXISTS uf_placa text,
  ADD COLUMN IF NOT EXISTS xml_importado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS xml_conteudo text;