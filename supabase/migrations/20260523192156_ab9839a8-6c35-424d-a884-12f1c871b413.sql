
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id),
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_conta_pagar(
  p_conta_id uuid,
  p_pagamentos jsonb,
  p_quitar boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta record;
  v_pag jsonb;
  v_total numeric := 0;
  v_forma text;
  v_valor numeric;
  v_origem_tipo text;
  v_origem_id uuid;
  v_descricao text;
  v_saldo numeric;
  v_user uuid := auth.uid();
  v_primeira_forma text := NULL;
  v_primeira_conta uuid := NULL;
BEGIN
  SELECT * INTO v_conta FROM public.contas_pagar WHERE id = p_conta_id;
  IF v_conta.id IS NULL THEN
    RAISE EXCEPTION 'Conta a pagar não encontrada';
  END IF;
  IF NOT (has_role(v_user,'super_admin'::app_role) OR unidade_belongs_to_user_empresa(v_conta.unidade_id) OR v_conta.unidade_id IS NULL) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos)
  LOOP
    v_forma := v_pag->>'forma';
    v_valor := COALESCE((v_pag->>'valor')::numeric, 0);
    v_origem_tipo := v_pag->>'origem_tipo';  -- 'caixa' | 'banco' | 'cartao'
    v_origem_id := NULLIF(v_pag->>'origem_id','')::uuid;

    IF v_valor <= 0 OR v_forma IS NULL OR v_forma = '' THEN CONTINUE; END IF;
    IF v_primeira_forma IS NULL THEN v_primeira_forma := v_forma; END IF;

    v_descricao := 'Pagto ' || COALESCE(v_conta.fornecedor,'') || ' — ' || COALESCE(v_conta.descricao,'');

    IF v_origem_tipo = 'caixa' THEN
      INSERT INTO public.movimentacoes_caixa (tipo, descricao, valor, categoria, unidade_id, observacoes, plano_contas_id)
      VALUES ('saida', v_descricao, v_valor, COALESCE(v_conta.categoria,'Pagamento de Conta'), v_conta.unidade_id,
              'Conta a pagar #' || left(p_conta_id::text,8) || ' (' || v_forma || ')', v_conta.plano_contas_id);
    ELSIF v_origem_tipo = 'banco' AND v_origem_id IS NOT NULL THEN
      IF v_primeira_conta IS NULL THEN v_primeira_conta := v_origem_id; END IF;

      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) - v_valor
       WHERE id = v_origem_id
       RETURNING saldo_atual INTO v_saldo;

      INSERT INTO public.movimentacoes_bancarias
        (conta_bancaria_id, data, tipo, categoria, descricao, valor, saldo_apos,
         referencia_id, referencia_tipo, observacoes, user_id, unidade_id, plano_contas_id)
      VALUES (v_origem_id, CURRENT_DATE, 'saida', 'contas_pagar', v_descricao, v_valor, v_saldo,
              p_conta_id, 'contas_pagar', v_forma, v_user, v_conta.unidade_id, v_conta.plano_contas_id);
    END IF;
    -- cartao: nenhum lançamento agora (será via fatura)

    v_total := v_total + v_valor;
  END LOOP;

  IF p_quitar THEN
    UPDATE public.contas_pagar
       SET status = 'paga',
           data_pagamento = CURRENT_DATE,
           forma_pagamento = v_primeira_forma,
           conta_bancaria_id = COALESCE(v_primeira_conta, conta_bancaria_id)
     WHERE id = p_conta_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'total_pago', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pagamento_conta_pagar(uuid, jsonb, boolean) TO authenticated;
