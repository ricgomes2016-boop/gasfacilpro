
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS serie text,
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS natureza_operacao text,
  ADD COLUMN IF NOT EXISTS cfop_predominante text,
  ADD COLUMN IF NOT EXISTS valor_produtos numeric,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric,
  ADD COLUMN IF NOT EXISTS valor_seguro numeric,
  ADD COLUMN IF NOT EXISTS valor_outros numeric,
  ADD COLUMN IF NOT EXISTS valor_icms numeric,
  ADD COLUMN IF NOT EXISTS valor_icms_st numeric,
  ADD COLUMN IF NOT EXISTS valor_ipi numeric,
  ADD COLUMN IF NOT EXISTS valor_pis numeric,
  ADD COLUMN IF NOT EXISTS valor_cofins numeric,
  ADD COLUMN IF NOT EXISTS base_icms numeric,
  ADD COLUMN IF NOT EXISTS base_icms_st numeric,
  ADD COLUMN IF NOT EXISTS transportadora_nome text,
  ADD COLUMN IF NOT EXISTS transportadora_cnpj text,
  ADD COLUMN IF NOT EXISTS placa_veiculo text,
  ADD COLUMN IF NOT EXISTS modalidade_frete text,
  ADD COLUMN IF NOT EXISTS xml_content text;

ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS descricao_xml text,
  ADD COLUMN IF NOT EXISTS codigo_produto_fornecedor text,
  ADD COLUMN IF NOT EXISTS unidade_xml text,
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS codigo_anp text,
  ADD COLUMN IF NOT EXISTS cst_icms text,
  ADD COLUMN IF NOT EXISTS csosn_icms text,
  ADD COLUMN IF NOT EXISTS cst_pis text,
  ADD COLUMN IF NOT EXISTS cst_cofins text,
  ADD COLUMN IF NOT EXISTS aliquota_icms numeric,
  ADD COLUMN IF NOT EXISTS aliquota_pis numeric,
  ADD COLUMN IF NOT EXISTS aliquota_cofins numeric,
  ADD COLUMN IF NOT EXISTS valor_icms numeric,
  ADD COLUMN IF NOT EXISTS valor_pis numeric,
  ADD COLUMN IF NOT EXISTS valor_cofins numeric,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS estado text;

CREATE INDEX IF NOT EXISTS idx_compras_chave_nfe ON public.compras(chave_nfe);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON public.clientes(tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON public.clientes(cnpj);
