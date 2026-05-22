
-- Add fields to vendas_antecipadas
ALTER TABLE public.vendas_antecipadas
  ADD COLUMN IF NOT EXISTS numero_sequencial integer,
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS total_unidades integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidades_retiradas integer NOT NULL DEFAULT 0;

-- Items table
CREATE TABLE IF NOT EXISTS public.vendas_antecipadas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_antecipada_id uuid NOT NULL REFERENCES public.vendas_antecipadas(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id),
  produto_nome text NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  quantidade_retirada integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_va_itens_venda ON public.vendas_antecipadas_itens(venda_antecipada_id);

ALTER TABLE public.vendas_antecipadas_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso itens via venda antecipada" ON public.vendas_antecipadas_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendas_antecipadas va WHERE va.id = venda_antecipada_id
    AND (has_role(auth.uid(),'super_admin'::app_role) OR unidade_belongs_to_user_empresa(va.unidade_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendas_antecipadas va WHERE va.id = venda_antecipada_id
    AND (has_role(auth.uid(),'super_admin'::app_role) OR unidade_belongs_to_user_empresa(va.unidade_id))));

-- Vales (1 per unit)
CREATE TABLE IF NOT EXISTS public.vendas_antecipadas_vales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_antecipada_id uuid NOT NULL REFERENCES public.vendas_antecipadas(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.vendas_antecipadas_itens(id) ON DELETE CASCADE,
  produto_id uuid,
  produto_nome text NOT NULL,
  numero integer NOT NULL,
  codigo text NOT NULL UNIQUE,
  valor_unitario numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','retirado','cancelado')),
  cliente_id uuid REFERENCES public.clientes(id),
  unidade_id uuid REFERENCES public.unidades(id),
  empresa_id uuid,
  data_retirada timestamptz,
  retirado_por uuid,
  pedido_id uuid REFERENCES public.pedidos(id),
  observacao_retirada text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_va_vales_venda ON public.vendas_antecipadas_vales(venda_antecipada_id);
CREATE INDEX IF NOT EXISTS idx_va_vales_codigo ON public.vendas_antecipadas_vales(codigo);
CREATE INDEX IF NOT EXISTS idx_va_vales_unidade ON public.vendas_antecipadas_vales(unidade_id);

ALTER TABLE public.vendas_antecipadas_vales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vales VA tenant" ON public.vendas_antecipadas_vales
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

-- Trigger: numero_sequencial + empresa_id
CREATE OR REPLACE FUNCTION public.fn_va_assign_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_emp uuid; v_next int;
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp FROM public.unidades WHERE id = NEW.unidade_id;
    NEW.empresa_id := v_emp;
  END IF;
  IF NEW.numero_sequencial IS NULL THEN
    SELECT COALESCE(MAX(numero_sequencial),0)+1 INTO v_next
    FROM public.vendas_antecipadas WHERE empresa_id = NEW.empresa_id;
    NEW.numero_sequencial := v_next;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_va_assign_numero ON public.vendas_antecipadas;
CREATE TRIGGER trg_va_assign_numero BEFORE INSERT ON public.vendas_antecipadas
  FOR EACH ROW EXECUTE FUNCTION public.fn_va_assign_numero();

-- Trigger: recalc totals on vales status change
CREATE OR REPLACE FUNCTION public.fn_va_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_va uuid; v_total int; v_ret int;
BEGIN
  v_va := COALESCE(NEW.venda_antecipada_id, OLD.venda_antecipada_id);
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status='retirado') INTO v_total, v_ret
  FROM public.vendas_antecipadas_vales WHERE venda_antecipada_id = v_va;
  UPDATE public.vendas_antecipadas
    SET total_unidades = v_total,
        unidades_retiradas = v_ret,
        status = CASE
          WHEN status = 'cancelado' THEN 'cancelado'
          WHEN v_ret = 0 THEN 'ativo'
          WHEN v_ret >= v_total THEN 'utilizado'
          ELSE 'parcial' END
  WHERE id = v_va;

  -- update item quantity_retirada
  IF TG_OP <> 'DELETE' THEN
    UPDATE public.vendas_antecipadas_itens i
      SET quantidade_retirada = (SELECT COUNT(*) FROM public.vendas_antecipadas_vales
        WHERE item_id = i.id AND status='retirado')
    WHERE i.id = NEW.item_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_va_recalc ON public.vendas_antecipadas_vales;
CREATE TRIGGER trg_va_recalc AFTER INSERT OR UPDATE OF status OR DELETE ON public.vendas_antecipadas_vales
  FOR EACH ROW EXECUTE FUNCTION public.fn_va_recalc();

-- RPC: consume a vale by codigo
CREATE OR REPLACE FUNCTION public.consumir_vale_venda_antecipada(_codigo text, _pedido_id uuid DEFAULT NULL, _observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_vale record; v_user uuid;
BEGIN
  v_user := auth.uid();
  SELECT * INTO v_vale FROM public.vendas_antecipadas_vales WHERE codigo = _codigo;
  IF v_vale.id IS NULL THEN RAISE EXCEPTION 'Vale não encontrado'; END IF;
  IF v_vale.status = 'retirado' THEN RAISE EXCEPTION 'Vale já foi retirado em %', v_vale.data_retirada; END IF;
  IF v_vale.status = 'cancelado' THEN RAISE EXCEPTION 'Vale cancelado'; END IF;
  IF NOT (has_role(v_user,'super_admin'::app_role) OR unidade_belongs_to_user_empresa(v_vale.unidade_id)
          OR EXISTS (SELECT 1 FROM public.entregadores WHERE user_id = v_user AND unidade_id = v_vale.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.vendas_antecipadas_vales
    SET status='retirado', data_retirada=now(), retirado_por=v_user, pedido_id=_pedido_id, observacao_retirada=_observacao
    WHERE id = v_vale.id;
  RETURN jsonb_build_object('ok', true, 'vale_id', v_vale.id, 'venda_antecipada_id', v_vale.venda_antecipada_id,
    'produto_nome', v_vale.produto_nome, 'numero', v_vale.numero);
END $$;
