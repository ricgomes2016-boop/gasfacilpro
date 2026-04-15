
CREATE TABLE public.transp_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  data date NOT NULL,
  fornecedor text NOT NULL,
  cidade_fornecedor text,
  distancia_ida_km numeric DEFAULT 0,
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  qtd_p13 integer DEFAULT 0,
  qtd_p20 integer DEFAULT 0,
  qtd_p45 integer DEFAULT 0,
  qtd_agua integer DEFAULT 0,
  valor_compra numeric DEFAULT 0,
  custo_combustivel numeric DEFAULT 0,
  custo_pedagio numeric DEFAULT 0,
  custo_refeicao numeric DEFAULT 0,
  custo_outros numeric DEFAULT 0,
  custo_logistico_total numeric DEFAULT 0,
  custo_total numeric DEFAULT 0,
  custo_unit_p13 numeric DEFAULT 0,
  custo_unit_p20 numeric DEFAULT 0,
  custo_unit_p45 numeric DEFAULT 0,
  custo_unit_agua numeric DEFAULT 0,
  mes_referencia text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transp_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transp_compras of their empresa"
  ON public.transp_compras FOR SELECT TO authenticated
  USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Users can insert transp_compras for their empresa"
  ON public.transp_compras FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Users can update transp_compras of their empresa"
  ON public.transp_compras FOR UPDATE TO authenticated
  USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Users can delete transp_compras of their empresa"
  ON public.transp_compras FOR DELETE TO authenticated
  USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE TRIGGER update_transp_compras_updated_at
  BEFORE UPDATE ON public.transp_compras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
