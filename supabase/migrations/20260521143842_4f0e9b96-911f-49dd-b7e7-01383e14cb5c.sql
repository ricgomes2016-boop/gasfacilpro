
-- 1. Tabela empenhos
CREATE TABLE public.empenhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  empresa_id uuid,
  parceiro_id uuid NOT NULL REFERENCES public.vale_gas_parceiros(id),
  licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  numero_empenho text NOT NULL,
  data_empenho date NOT NULL DEFAULT CURRENT_DATE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  produto_nome text NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric(15,2) NOT NULL CHECK (valor_unitario >= 0),
  valor_total numeric(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  quantidade_entregue integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','parcial','concluido','cancelado')),
  observacoes text,
  nfe_id text,
  nfe_numero text,
  nfe_chave text,
  nfe_status text
);

CREATE UNIQUE INDEX idx_empenhos_empresa_numero ON public.empenhos(empresa_id, numero_empenho);
CREATE INDEX idx_empenhos_parceiro ON public.empenhos(parceiro_id);
CREATE INDEX idx_empenhos_unidade ON public.empenhos(unidade_id);
CREATE INDEX idx_empenhos_status ON public.empenhos(status);

-- Trigger updated_at
CREATE TRIGGER trg_empenhos_updated_at
BEFORE UPDATE ON public.empenhos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Trigger: preencher empresa_id a partir da unidade
CREATE OR REPLACE FUNCTION public.fn_empenho_fill_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO NEW.empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_empenho_fill_empresa
BEFORE INSERT OR UPDATE ON public.empenhos
FOR EACH ROW EXECUTE FUNCTION public.fn_empenho_fill_empresa();

-- 3. Extensão vale_gas
ALTER TABLE public.vale_gas
  ADD COLUMN IF NOT EXISTS empenho_id uuid REFERENCES public.empenhos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cliente_final_id uuid REFERENCES public.clientes(id);

CREATE INDEX IF NOT EXISTS idx_vale_gas_empenho ON public.vale_gas(empenho_id);

-- 4. RLS empenhos
ALTER TABLE public.empenhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empenhos: select empresa"
ON public.empenhos FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  )
);

CREATE POLICY "Empenhos: insert empresa"
ON public.empenhos FOR INSERT
TO authenticated
WITH CHECK (
  unidade_id IS NOT NULL
  AND public.unidade_belongs_to_user_empresa(unidade_id)
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  )
);

CREATE POLICY "Empenhos: update empresa"
ON public.empenhos FOR UPDATE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  )
);

CREATE POLICY "Empenhos: delete empresa"
ON public.empenhos FOR DELETE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
);

-- 5. Trigger: atualizar saldo do empenho quando vale muda
CREATE OR REPLACE FUNCTION public.fn_empenho_atualizar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empenho_ids uuid[];
  v_eid uuid;
  v_qtd_total integer;
  v_qtd_entregue integer;
BEGIN
  v_empenho_ids := ARRAY[]::uuid[];
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.empenho_id IS NOT NULL THEN
    v_empenho_ids := array_append(v_empenho_ids, NEW.empenho_id);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.empenho_id IS NOT NULL AND NOT (OLD.empenho_id = ANY(v_empenho_ids)) THEN
    v_empenho_ids := array_append(v_empenho_ids, OLD.empenho_id);
  END IF;

  FOREACH v_eid IN ARRAY v_empenho_ids LOOP
    SELECT quantidade INTO v_qtd_total FROM public.empenhos WHERE id = v_eid;
    SELECT COUNT(*) INTO v_qtd_entregue FROM public.vale_gas WHERE empenho_id = v_eid AND status = 'utilizado';
    UPDATE public.empenhos
    SET quantidade_entregue = v_qtd_entregue,
        status = CASE
          WHEN status = 'cancelado' THEN 'cancelado'
          WHEN v_qtd_entregue = 0 THEN 'aberto'
          WHEN v_qtd_entregue >= v_qtd_total THEN 'concluido'
          ELSE 'parcial'
        END
    WHERE id = v_eid;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_vale_gas_atualizar_empenho
AFTER INSERT OR UPDATE OR DELETE ON public.vale_gas
FOR EACH ROW EXECUTE FUNCTION public.fn_empenho_atualizar_saldo();

-- 6. RPC: vincular intervalo de vales ao empenho
CREATE OR REPLACE FUNCTION public.vincular_vales_empenho(
  _empenho_id uuid,
  _numero_inicial integer,
  _numero_final integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_intervalo integer;
  v_ja_existe integer;
  v_duplicados integer;
  v_codigo text;
  v_ano text;
  i integer;
BEGIN
  SELECT * INTO v_emp FROM public.empenhos WHERE id = _empenho_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'Empenho não encontrado';
  END IF;
  IF v_emp.empresa_id <> public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _numero_inicial IS NULL OR _numero_final IS NULL OR _numero_final < _numero_inicial THEN
    RAISE EXCEPTION 'Intervalo inválido';
  END IF;

  v_intervalo := _numero_final - _numero_inicial + 1;
  IF v_intervalo <> v_emp.quantidade THEN
    RAISE EXCEPTION 'A quantidade do intervalo (%) não bate com o empenho (%)', v_intervalo, v_emp.quantidade;
  END IF;

  SELECT COUNT(*) INTO v_ja_existe FROM public.vale_gas WHERE empenho_id = _empenho_id;
  IF v_ja_existe > 0 THEN
    RAISE EXCEPTION 'Este empenho já possui vales vinculados';
  END IF;

  SELECT COUNT(*) INTO v_duplicados FROM public.vale_gas
   WHERE numero BETWEEN _numero_inicial AND _numero_final;
  IF v_duplicados > 0 THEN
    RAISE EXCEPTION 'Existem números neste intervalo já cadastrados em outro lote/empenho';
  END IF;

  -- Cria lote container (reaproveita estrutura vale_gas_lotes)
  v_ano := to_char(now(), 'YYYY');
  INSERT INTO public.vale_gas_lotes (
    parceiro_id, quantidade, valor_unitario, valor_total,
    numero_inicial, numero_final, descricao, produto_id, produto_nome, unidade_id, observacao
  ) VALUES (
    v_emp.parceiro_id, v_emp.quantidade, v_emp.valor_unitario, v_emp.valor_total,
    _numero_inicial, _numero_final,
    'Empenho ' || v_emp.numero_empenho,
    v_emp.produto_id, v_emp.produto_nome, v_emp.unidade_id,
    'Vinculado ao empenho ' || v_emp.numero_empenho
  )
  RETURNING id INTO v_codigo; -- reuse var to capture id
  -- v_codigo now contains the lote_id (text cast)
  
  FOR i IN _numero_inicial.._numero_final LOOP
    INSERT INTO public.vale_gas (
      numero, codigo, valor, parceiro_id, lote_id, status,
      descricao, produto_id, produto_nome, unidade_id, empenho_id
    ) VALUES (
      i,
      'VG-' || v_ano || '-' || LPAD(i::text, 5, '0'),
      v_emp.valor_unitario,
      v_emp.parceiro_id,
      v_codigo::uuid,
      'disponivel',
      'Empenho ' || v_emp.numero_empenho,
      v_emp.produto_id,
      v_emp.produto_nome,
      v_emp.unidade_id,
      _empenho_id
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'vales_criados', v_intervalo, 'lote_id', v_codigo);
END;
$$;

-- 7. RPC: consumir vale na venda
CREATE OR REPLACE FUNCTION public.consumir_vale_empenho(
  _parceiro_id uuid,
  _numero_vale integer,
  _cliente_final_id uuid,
  _pedido_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vale record;
  v_saldo integer;
BEGIN
  SELECT * INTO v_vale FROM public.vale_gas
   WHERE parceiro_id = _parceiro_id AND numero = _numero_vale
   LIMIT 1;

  IF v_vale.id IS NULL THEN
    RAISE EXCEPTION 'Vale % não encontrado para este parceiro', _numero_vale;
  END IF;
  IF v_vale.status = 'utilizado' THEN
    RAISE EXCEPTION 'Vale % já foi consumido', _numero_vale;
  END IF;
  IF v_vale.status = 'cancelado' THEN
    RAISE EXCEPTION 'Vale % está cancelado', _numero_vale;
  END IF;

  UPDATE public.vale_gas
     SET status = 'utilizado',
         data_utilizacao = now(),
         cliente_final_id = _cliente_final_id,
         venda_id = _pedido_id,
         cliente_id = COALESCE(cliente_id, _cliente_final_id)
   WHERE id = v_vale.id;

  IF v_vale.empenho_id IS NOT NULL THEN
    SELECT (quantidade - quantidade_entregue) INTO v_saldo FROM public.empenhos WHERE id = v_vale.empenho_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'vale_id', v_vale.id,
    'empenho_id', v_vale.empenho_id,
    'saldo_restante', v_saldo
  );
END;
$$;
