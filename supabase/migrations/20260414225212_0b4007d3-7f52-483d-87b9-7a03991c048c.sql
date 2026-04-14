
-- Tabela principal de rotas atacado
CREATE TABLE public.transp_rotas_atacado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'atacado',
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  motorista_id uuid REFERENCES public.transp_funcionarios(id),
  ajudante_id uuid REFERENCES public.transp_funcionarios(id),
  status text NOT NULL DEFAULT 'rascunho',
  data_prevista date,
  km_total numeric(10,2) DEFAULT 0,
  tempo_total_min integer DEFAULT 0,
  custo_total numeric(10,2) DEFAULT 0,
  carga_inicial_p13 integer DEFAULT 0,
  carga_inicial_p20 integer DEFAULT 0,
  carga_inicial_p45 integer DEFAULT 0,
  consumo_km_litro numeric(6,2) DEFAULT 5.0,
  preco_combustivel numeric(6,2) DEFAULT 6.50,
  custo_pedagio numeric(10,2) DEFAULT 0,
  custo_refeicao numeric(10,2) DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de paradas da rota
CREATE TABLE public.transp_rota_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid REFERENCES public.transp_rotas_atacado(id) ON DELETE CASCADE NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  tipo_parada text NOT NULL DEFAULT 'venda',
  cidade text,
  endereco text,
  lat numeric(10,7),
  lng numeric(10,7),
  qtd_p13 integer DEFAULT 0,
  qtd_p20 integer DEFAULT 0,
  qtd_p45 integer DEFAULT 0,
  operacao text DEFAULT 'saida',
  observacoes text,
  concluida boolean DEFAULT false,
  concluida_em timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.transp_rotas_atacado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transp_rota_paradas ENABLE ROW LEVEL SECURITY;

-- Policies para transp_rotas_atacado
CREATE POLICY "Users can view own empresa rotas atacado"
  ON public.transp_rotas_atacado FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can create rotas atacado for own empresa"
  ON public.transp_rotas_atacado FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update own empresa rotas atacado"
  ON public.transp_rotas_atacado FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete own empresa rotas atacado"
  ON public.transp_rotas_atacado FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Policies para transp_rota_paradas (via join com rota)
CREATE POLICY "Users can view paradas of own empresa rotas"
  ON public.transp_rota_paradas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.transp_rotas_atacado r
    WHERE r.id = rota_id AND r.empresa_id = public.get_user_empresa_id()
  ));

CREATE POLICY "Users can create paradas for own empresa rotas"
  ON public.transp_rota_paradas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transp_rotas_atacado r
    WHERE r.id = rota_id AND r.empresa_id = public.get_user_empresa_id()
  ));

CREATE POLICY "Users can update paradas of own empresa rotas"
  ON public.transp_rota_paradas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.transp_rotas_atacado r
    WHERE r.id = rota_id AND r.empresa_id = public.get_user_empresa_id()
  ));

CREATE POLICY "Users can delete paradas of own empresa rotas"
  ON public.transp_rota_paradas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.transp_rotas_atacado r
    WHERE r.id = rota_id AND r.empresa_id = public.get_user_empresa_id()
  ));

-- Trigger updated_at
CREATE TRIGGER update_transp_rotas_atacado_updated_at
  BEFORE UPDATE ON public.transp_rotas_atacado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
