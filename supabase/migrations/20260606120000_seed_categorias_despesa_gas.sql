-- Default expense categories for gas/water distributors.
-- The seed is idempotent by unit + normalized name, so it can be rerun safely.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.seed_categorias_despesa_gas(_unidade_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF _unidade_id IS NULL THEN
    RAISE EXCEPTION 'unidade_id is required';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.unidade_belongs_to_user_empresa(_unidade_id)
  ) THEN
    RAISE EXCEPTION 'unidade fora da empresa do usuario';
  END IF;

  WITH defaults(nome, grupo, tipo, codigo_contabil, descricao, ordem) AS (
    VALUES
      -- Compras e custo direto
      ('Compra de GLP P13', 'compras_mercadorias', 'variavel', '3.1.01.001', 'Botijoes P13 para revenda', 10),
      ('Compra de GLP P20', 'compras_mercadorias', 'variavel', '3.1.01.002', 'Cilindros P20 para revenda', 11),
      ('Compra de GLP P45', 'compras_mercadorias', 'variavel', '3.1.01.003', 'Cilindros P45 para revenda', 12),
      ('Compra de Agua Mineral', 'compras_mercadorias', 'variavel', '3.1.01.004', 'Aguas e retornaveis para revenda', 13),
      ('Frete de Compra', 'compras_mercadorias', 'variavel', '3.1.02.001', 'Frete sobre compras de mercadorias', 14),
      ('Perdas e Avarias de Estoque', 'compras_mercadorias', 'variavel', '3.1.03.001', 'Quebras, avarias e perdas operacionais de estoque', 15),

      -- Frota e entrega
      ('Combustivel da Frota', 'frota_entrega', 'variavel', '4.3.01.001', 'Gasolina, etanol, diesel e lubrificantes', 20),
      ('Manutencao de Veiculos', 'frota_entrega', 'variavel', '4.3.01.002', 'Mecanica, revisoes, pneus e pecas', 21),
      ('Documentacao de Veiculos', 'frota_entrega', 'fixo', '4.3.01.003', 'IPVA, licenciamento, despachante e taxas', 22),
      ('Seguro da Frota', 'frota_entrega', 'fixo', '4.3.01.004', 'Seguro de motos, carros e caminhoes', 23),
      ('Pedagios e Estacionamentos', 'frota_entrega', 'variavel', '4.3.01.005', 'Pedagios, zona azul e estacionamentos', 24),
      ('Rastreamento e Telemetria', 'frota_entrega', 'fixo', '4.3.01.006', 'Rastreador, monitoramento e telemetria da frota', 25),

      -- Pessoal
      ('Salarios e Ordenados', 'pessoal', 'fixo', '4.2.01.001', 'Folha de pagamento dos colaboradores', 30),
      ('Encargos Trabalhistas', 'pessoal', 'fixo', '4.2.01.002', 'INSS, FGTS e encargos sobre folha', 31),
      ('Pro-Labore', 'pessoal', 'fixo', '4.2.01.003', 'Retirada dos socios administradores', 32),
      ('Vale Transporte', 'pessoal', 'fixo', '4.2.01.004', 'Beneficio de transporte', 33),
      ('Vale Alimentacao e Refeicao', 'pessoal', 'fixo', '4.2.01.005', 'VR, VA e refeicoes de equipe', 34),
      ('Comissoes de Vendas e Entregas', 'pessoal', 'variavel', '4.2.01.006', 'Comissoes e premiacoes variaveis', 35),
      ('Treinamentos e Uniformes', 'pessoal', 'variavel', '4.2.01.007', 'Uniformes, EPIs e treinamentos', 36),

      -- Ocupacao e estrutura
      ('Aluguel do Imovel', 'ocupacao_estrutura', 'fixo', '4.1.01.001', 'Aluguel da loja, deposito ou escritorio', 40),
      ('Energia Eletrica', 'ocupacao_estrutura', 'fixo', '4.1.01.002', 'Conta de energia eletrica', 41),
      ('Agua e Esgoto', 'ocupacao_estrutura', 'fixo', '4.1.01.003', 'Conta de agua e esgoto', 42),
      ('Internet e Telefonia', 'ocupacao_estrutura', 'fixo', '4.1.01.004', 'Internet, telefonia fixa e movel', 43),
      ('Limpeza e Conservacao', 'ocupacao_estrutura', 'variavel', '4.1.01.005', 'Limpeza, higiene e conservacao predial', 44),
      ('Seguranca e Monitoramento', 'ocupacao_estrutura', 'fixo', '4.1.01.006', 'Alarme, cameras e vigilancia', 45),
      ('Manutencao Predial', 'ocupacao_estrutura', 'variavel', '4.1.01.007', 'Reparos e manutencao da estrutura fisica', 46),

      -- Administrativo
      ('Honorarios Contabeis', 'administrativo', 'fixo', '4.4.01.001', 'Contabilidade e assessoria fiscal', 50),
      ('Sistemas e Softwares', 'administrativo', 'fixo', '4.4.01.002', 'ERP, aplicativos, licencas e assinaturas', 51),
      ('Material de Escritorio', 'administrativo', 'variavel', '4.4.01.003', 'Papelaria e suprimentos administrativos', 52),
      ('Despesas Juridicas e Cartorio', 'administrativo', 'variavel', '4.4.01.004', 'Advocacia, cartorio e taxas legais', 53),
      ('Certificados Digitais', 'administrativo', 'fixo', '4.4.01.005', 'Certificados digitais e renovacoes', 54),

      -- Comercial e atendimento
      ('Marketing e Publicidade', 'comercial', 'variavel', '4.5.01.001', 'Anuncios, artes, trafego pago e divulgacao', 60),
      ('Taxas de Cartao e Maquininha', 'comercial', 'variavel', '4.5.01.002', 'Taxas de adquirentes, Pix intermediado e aluguel POS', 61),
      ('Plataformas de Venda e Delivery', 'comercial', 'variavel', '4.5.01.003', 'Marketplaces, aplicativos e integradores de venda', 62),
      ('Brindes e Promocoes', 'comercial', 'variavel', '4.5.01.004', 'Cupons, brindes e acoes promocionais', 63),

      -- Financeiro
      ('Tarifas Bancarias', 'financeiro', 'fixo', '4.6.01.001', 'Pacotes, TED, DOC, Pix pago e tarifas de conta', 70),
      ('Juros e Multas Pagas', 'financeiro', 'variavel', '4.6.01.002', 'Juros, multas e encargos por atraso', 71),
      ('Emprestimos e Financiamentos', 'financeiro', 'fixo', '4.6.01.003', 'Parcelas e encargos de credito contratado', 72),
      ('IOF e Encargos Financeiros', 'financeiro', 'variavel', '4.6.01.004', 'IOF e demais despesas financeiras', 73),

      -- Impostos
      ('Simples Nacional DAS', 'impostos', 'variavel', '4.7.01.001', 'Guia DAS do Simples Nacional', 80),
      ('ICMS', 'impostos', 'variavel', '4.7.01.002', 'ICMS e substituicao tributaria quando aplicavel', 81),
      ('ISS', 'impostos', 'variavel', '4.7.01.003', 'Imposto sobre servicos', 82),
      ('Taxas Municipais e Alvaras', 'impostos', 'fixo', '4.7.01.004', 'Alvaras, taxas municipais e licencas', 83),

      -- Outros
      ('Doacoes e Contribuicoes', 'diversos', 'variavel', '4.9.01.001', 'Contribuicoes, doacoes e apoios locais', 90),
      ('Despesas Diversas', 'diversos', 'variavel', '4.9.01.999', 'Despesas eventuais nao classificadas', 99)
  ),
  updated AS (
    UPDATE public.categorias_despesa c
    SET
      codigo_contabil = COALESCE(NULLIF(c.codigo_contabil, ''), d.codigo_contabil),
      descricao = COALESCE(NULLIF(c.descricao, ''), d.descricao),
      grupo = COALESCE(NULLIF(c.grupo, ''), d.grupo),
      tipo = COALESCE(NULLIF(c.tipo, ''), d.tipo),
      ordem = CASE WHEN c.ordem = 0 THEN d.ordem ELSE c.ordem END,
      updated_at = now()
    FROM defaults d
    WHERE c.unidade_id = _unidade_id
      AND lower(public.unaccent(c.nome)) = lower(public.unaccent(d.nome))
  ),
  inserted AS (
    INSERT INTO public.categorias_despesa (
      nome, grupo, tipo, codigo_contabil, descricao, valor_padrao, ativo, ordem, unidade_id
    )
    SELECT d.nome, d.grupo, d.tipo, d.codigo_contabil, d.descricao, 0, true, d.ordem, _unidade_id
    FROM defaults d
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.categorias_despesa c
      WHERE c.unidade_id = _unidade_id
        AND lower(public.unaccent(c.nome)) = lower(public.unaccent(d.nome))
    )
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_categorias_despesa_gas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_categorias_despesa_gas(uuid) TO authenticated;
