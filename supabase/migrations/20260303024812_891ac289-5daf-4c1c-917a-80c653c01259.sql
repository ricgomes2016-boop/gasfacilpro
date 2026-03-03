
-- ============================================
-- WORKFLOW DE APROVAÇÕES (SAP Workflow)
-- ============================================
CREATE TABLE public.alcadas_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id),
  tipo TEXT NOT NULL, -- 'despesa','compra','desconto','cancelamento'
  nivel INTEGER NOT NULL DEFAULT 1,
  valor_minimo NUMERIC DEFAULT 0,
  valor_maximo NUMERIC,
  cargo_aprovador TEXT NOT NULL, -- 'operador','gestor','diretor'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id),
  tipo TEXT NOT NULL,
  registro_id UUID,
  tabela_origem TEXT,
  descricao TEXT NOT NULL,
  valor NUMERIC DEFAULT 0,
  solicitante_id UUID NOT NULL,
  aprovador_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, aprovado, rejeitado
  nivel_atual INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  data_decisao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alcadas_aprovacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alcadas: empresa" ON public.alcadas_aprovacao FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Aprovacoes: empresa" ON public.aprovacoes FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- ============================================
-- GESTÃO DE CRÉDITO DO CLIENTE (SAP SD Credit)
-- ============================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS limite_credito NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_devedor NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_risco TEXT DEFAULT 'medio',
  ADD COLUMN IF NOT EXISTS bloqueio_credito BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT,
  ADD COLUMN IF NOT EXISTS data_ultimo_pagamento TIMESTAMPTZ;

CREATE TABLE public.politicas_cobranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dias_atraso_alerta INTEGER DEFAULT 3,
  dias_atraso_bloqueio INTEGER DEFAULT 15,
  dias_atraso_negativacao INTEGER DEFAULT 30,
  mensagem_alerta TEXT,
  mensagem_bloqueio TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.politicas_cobranca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Politicas: empresa" ON public.politicas_cobranca FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- ============================================
-- BATCH/LOTE & RASTREABILIDADE (SAP QM/MM)
-- ============================================
CREATE TABLE public.lotes_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id),
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  numero_lote TEXT NOT NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  data_fabricacao DATE,
  data_validade DATE,
  quantidade_inicial INTEGER NOT NULL DEFAULT 0,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  certificado_url TEXT,
  status TEXT DEFAULT 'ativo', -- ativo, vencido, recall
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rastreio_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES public.lotes_produto(id),
  pedido_id UUID REFERENCES public.pedidos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  tipo TEXT NOT NULL DEFAULT 'saida', -- entrada, saida, recall
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lotes_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rastreio_lote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lotes: empresa" ON public.lotes_produto FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Rastreio: via lote empresa" ON public.rastreio_lote FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lotes_produto l WHERE l.id = lote_id AND l.empresa_id = public.get_user_empresa_id()));

-- ============================================
-- SLA & INDICADORES DE ENTREGA
-- ============================================
CREATE TABLE public.sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id),
  nome TEXT NOT NULL DEFAULT 'Padrão',
  tempo_maximo_minutos INTEGER NOT NULL DEFAULT 40,
  penalidade_descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SLA: empresa" ON public.sla_config FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Adicionar campos de SLA nos pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS sla_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS sla_cumprido BOOLEAN,
  ADD COLUMN IF NOT EXISTS tempo_entrega_minutos INTEGER;

-- ============================================
-- FECHAMENTO MENSAL CONTÁBIL
-- ============================================
CREATE TABLE public.fechamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id),
  mes_referencia TEXT NOT NULL, -- '2026-03'
  status TEXT NOT NULL DEFAULT 'aberto', -- aberto, em_fechamento, fechado
  responsavel_id UUID,
  data_fechamento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, unidade_id, mes_referencia)
);

CREATE TABLE public.fechamento_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID NOT NULL REFERENCES public.fechamentos_mensais(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  categoria TEXT NOT NULL, -- 'conciliacao','provisao','depreciacao','conferencia'
  concluido BOOLEAN DEFAULT false,
  concluido_por UUID,
  concluido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamento_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fechamentos: empresa" ON public.fechamentos_mensais FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Checklist: via fechamento" ON public.fechamento_checklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fechamentos_mensais f WHERE f.id = fechamento_id AND f.empresa_id = public.get_user_empresa_id()));

-- Índices
CREATE INDEX idx_aprovacoes_status ON public.aprovacoes(empresa_id, status);
CREATE INDEX idx_lotes_produto ON public.lotes_produto(empresa_id, produto_id, status);
CREATE INDEX idx_lotes_validade ON public.lotes_produto(data_validade) WHERE status = 'ativo';
CREATE INDEX idx_fechamentos_mes ON public.fechamentos_mensais(empresa_id, mes_referencia);
