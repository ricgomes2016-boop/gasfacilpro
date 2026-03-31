
-- 1. Add transportadora role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'transportadora';

-- 2. Veículos da transportadora
CREATE TABLE public.transp_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  placa text NOT NULL,
  tipo text NOT NULL DEFAULT 'caminhao',
  capacidade_p13 integer NOT NULL DEFAULT 0,
  capacidade_p20 integer NOT NULL DEFAULT 0,
  capacidade_p45 integer NOT NULL DEFAULT 0,
  consumo_km_litro numeric(6,2) NOT NULL DEFAULT 5.0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Funcionários da transportadora
CREATE TABLE public.transp_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  cargo text NOT NULL DEFAULT 'motorista',
  salario_mensal numeric(10,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Simulações de viagem
CREATE TABLE public.transp_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  origem text NOT NULL,
  destino text NOT NULL,
  tipo text NOT NULL DEFAULT 'abastecimento',
  km numeric(10,2) NOT NULL DEFAULT 0,
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  motorista_id uuid REFERENCES public.transp_funcionarios(id),
  ajudante_id uuid REFERENCES public.transp_funcionarios(id),
  qtd_p13 integer NOT NULL DEFAULT 0,
  qtd_p20 integer NOT NULL DEFAULT 0,
  qtd_p45 integer NOT NULL DEFAULT 0,
  ida_volta boolean NOT NULL DEFAULT false,
  custo_combustivel numeric(10,2) NOT NULL DEFAULT 0,
  custo_pedagio numeric(10,2) NOT NULL DEFAULT 0,
  custo_refeicao numeric(10,2) NOT NULL DEFAULT 0,
  custo_motorista numeric(10,2) NOT NULL DEFAULT 0,
  custo_ajudante numeric(10,2) NOT NULL DEFAULT 0,
  custo_total numeric(10,2) NOT NULL DEFAULT 0,
  custo_p13_equiv numeric(10,4) NOT NULL DEFAULT 0,
  preco_combustivel_litro numeric(6,2) NOT NULL DEFAULT 6.50,
  origem_unidade_id uuid REFERENCES public.unidades(id),
  destino_unidade_id uuid REFERENCES public.unidades(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Abastecimento entre filiais (transferências)
CREATE TABLE public.transp_abastecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  origem_unidade_id uuid REFERENCES public.unidades(id) NOT NULL,
  destino_unidade_id uuid REFERENCES public.unidades(id) NOT NULL,
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  qtd_p13 integer NOT NULL DEFAULT 0,
  qtd_p20 integer NOT NULL DEFAULT 0,
  qtd_p45 integer NOT NULL DEFAULT 0,
  p13_equivalente numeric(10,2) NOT NULL DEFAULT 0,
  custo_logistico numeric(10,2) NOT NULL DEFAULT 0,
  custo_por_unidade numeric(10,4) NOT NULL DEFAULT 0,
  simulacao_id uuid REFERENCES public.transp_simulacoes(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Despesas reais (lançamento mensal)
CREATE TABLE public.transp_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL DEFAULT 'combustivel',
  descricao text,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  mes_referencia text,
  comprovante_url text,
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Entregas e vendas diretas
CREATE TABLE public.transp_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL DEFAULT 'transporte',
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  motorista_id uuid REFERENCES public.transp_funcionarios(id),
  destino_unidade_id uuid REFERENCES public.unidades(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  qtd_p13 integer NOT NULL DEFAULT 0,
  qtd_p20 integer NOT NULL DEFAULT 0,
  qtd_p45 integer NOT NULL DEFAULT 0,
  p13_equivalente numeric(10,2) NOT NULL DEFAULT 0,
  km numeric(10,2) NOT NULL DEFAULT 0,
  custo_total numeric(10,2) NOT NULL DEFAULT 0,
  valor_venda numeric(10,2) NOT NULL DEFAULT 0,
  margem numeric(10,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Fechamentos mensais
CREATE TABLE public.transp_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  mes_referencia text NOT NULL,
  total_despesas numeric(12,2) NOT NULL DEFAULT 0,
  total_p13_equivalente numeric(10,2) NOT NULL DEFAULT 0,
  custo_real_por_unidade numeric(10,4) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, mes_referencia)
);

-- Triggers for updated_at
CREATE TRIGGER tr_transp_veiculos_updated BEFORE UPDATE ON public.transp_veiculos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transp_funcionarios_updated BEFORE UPDATE ON public.transp_funcionarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transp_simulacoes_updated BEFORE UPDATE ON public.transp_simulacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transp_abastecimentos_updated BEFORE UPDATE ON public.transp_abastecimentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transp_despesas_updated BEFORE UPDATE ON public.transp_despesas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transp_entregas_updated BEFORE UPDATE ON public.transp_entregas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transp_fechamentos_updated BEFORE UPDATE ON public.transp_fechamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.transp_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_fechamentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies (empresa-based isolation)
CREATE POLICY "transp_veiculos_select" ON public.transp_veiculos FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_veiculos_insert" ON public.transp_veiculos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_veiculos_update" ON public.transp_veiculos FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_veiculos_delete" ON public.transp_veiculos FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "transp_funcionarios_select" ON public.transp_funcionarios FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_funcionarios_insert" ON public.transp_funcionarios FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_funcionarios_update" ON public.transp_funcionarios FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_funcionarios_delete" ON public.transp_funcionarios FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "transp_simulacoes_select" ON public.transp_simulacoes FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_simulacoes_insert" ON public.transp_simulacoes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_simulacoes_update" ON public.transp_simulacoes FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_simulacoes_delete" ON public.transp_simulacoes FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "transp_abastecimentos_select" ON public.transp_abastecimentos FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_abastecimentos_insert" ON public.transp_abastecimentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_abastecimentos_update" ON public.transp_abastecimentos FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_abastecimentos_delete" ON public.transp_abastecimentos FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "transp_despesas_select" ON public.transp_despesas FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_despesas_insert" ON public.transp_despesas FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_despesas_update" ON public.transp_despesas FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_despesas_delete" ON public.transp_despesas FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "transp_entregas_select" ON public.transp_entregas FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_entregas_insert" ON public.transp_entregas FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_entregas_update" ON public.transp_entregas FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_entregas_delete" ON public.transp_entregas FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "transp_fechamentos_select" ON public.transp_fechamentos FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_fechamentos_insert" ON public.transp_fechamentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_fechamentos_update" ON public.transp_fechamentos FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "transp_fechamentos_delete" ON public.transp_fechamentos FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- Storage bucket for comprovantes
INSERT INTO storage.buckets (id, name, public) VALUES ('transp-comprovantes', 'transp-comprovantes', false);

CREATE POLICY "transp_comprovantes_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'transp-comprovantes');
CREATE POLICY "transp_comprovantes_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'transp-comprovantes');
