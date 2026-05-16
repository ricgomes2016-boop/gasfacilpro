CREATE TABLE public.vendas_historicas_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  unidade_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quantidade numeric NOT NULL DEFAULT 0,
  faturamento numeric NOT NULL DEFAULT 0,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, produto_id, ano, mes)
);

CREATE INDEX idx_vhm_unidade_ano ON public.vendas_historicas_manuais(unidade_id, ano);
CREATE INDEX idx_vhm_empresa ON public.vendas_historicas_manuais(empresa_id);

ALTER TABLE public.vendas_historicas_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vhm_select" ON public.vendas_historicas_manuais
FOR SELECT TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "vhm_insert" ON public.vendas_historicas_manuais
FOR INSERT TO authenticated
WITH CHECK (
  public.unidade_belongs_to_user_empresa(unidade_id)
  AND empresa_id = public.get_user_empresa_id()
);

CREATE POLICY "vhm_update" ON public.vendas_historicas_manuais
FOR UPDATE TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "vhm_delete" ON public.vendas_historicas_manuais
FOR DELETE TO authenticated
USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE TRIGGER trg_vhm_updated_at
BEFORE UPDATE ON public.vendas_historicas_manuais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();