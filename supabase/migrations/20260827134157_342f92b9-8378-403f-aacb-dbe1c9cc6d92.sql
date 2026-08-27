-- 1) Idempotência: unicidade parcial só para espelhos de caixa
CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_bancarias_caixa_mirror_uniq
  ON public.movimentacoes_bancarias (conta_bancaria_id, referencia_id)
  WHERE referencia_tipo = 'movimentacao_caixa' AND referencia_id IS NOT NULL;

-- 2) Recalculo determinístico do saldo (com lock da conta)
CREATE OR REPLACE FUNCTION public.recalcular_saldo_conta_bancaria(p_conta_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicial numeric;
  v_saldo numeric;
BEGIN
  SELECT saldo_inicial INTO v_inicial
    FROM public.contas_bancarias WHERE id = p_conta_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0)
    INTO v_saldo
    FROM public.movimentacoes_bancarias
   WHERE conta_bancaria_id = p_conta_id;

  v_saldo := COALESCE(v_inicial, 0) + v_saldo;

  UPDATE public.contas_bancarias
     SET saldo_atual = v_saldo, updated_at = now()
   WHERE id = p_conta_id;

  RETURN v_saldo;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_saldo_conta_bancaria(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_saldo_conta_bancaria(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalcular_saldo_conta_bancaria(uuid) FROM authenticated;

-- 3) Trigger de espelhamento caixa -> banco
CREATE OR REPLACE FUNCTION public.fn_espelhar_caixa_em_banco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov public.movimentacoes_caixa%ROWTYPE;
  v_conta_id uuid;
  v_conta_antiga uuid;
  v_aprovado boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_mov := OLD;
  ELSE
    v_mov := NEW;
  END IF;

  -- Conta ativa configurada para dinheiro na unidade do movimento
  SELECT c.conta_bancaria_id INTO v_conta_id
    FROM public.config_destino_pagamento c
   WHERE c.forma_pagamento = 'dinheiro'
     AND c.ativo IS TRUE
     AND c.conta_bancaria_id IS NOT NULL
     AND c.unidade_id IS NOT DISTINCT FROM v_mov.unidade_id
   LIMIT 1;

  -- Remove espelhos antigos (qualquer conta) quando necessário
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_bancarias
     WHERE referencia_tipo = 'movimentacao_caixa' AND referencia_id = v_mov.id
     RETURNING conta_bancaria_id INTO v_conta_antiga;
    IF v_conta_antiga IS NOT NULL THEN
      PERFORM public.recalcular_saldo_conta_bancaria(v_conta_antiga);
    END IF;
    RETURN OLD;
  END IF;

  v_aprovado := lower(COALESCE(v_mov.status, '')) IN ('aprovado', 'aprovada');

  -- Limpa espelhos em contas que não são mais o destino (ou se não há destino/aprovação)
  FOR v_conta_antiga IN
    SELECT DISTINCT conta_bancaria_id
      FROM public.movimentacoes_bancarias
     WHERE referencia_tipo = 'movimentacao_caixa'
       AND referencia_id = v_mov.id
       AND (NOT v_aprovado OR v_conta_id IS NULL OR conta_bancaria_id <> v_conta_id)
  LOOP
    DELETE FROM public.movimentacoes_bancarias
     WHERE referencia_tipo = 'movimentacao_caixa'
       AND referencia_id = v_mov.id
       AND conta_bancaria_id = v_conta_antiga;
    PERFORM public.recalcular_saldo_conta_bancaria(v_conta_antiga);
  END LOOP;

  IF v_aprovado AND v_conta_id IS NOT NULL THEN
    INSERT INTO public.movimentacoes_bancarias (
      conta_bancaria_id, data, tipo, categoria, descricao, valor,
      referencia_id, referencia_tipo, unidade_id, observacoes
    ) VALUES (
      v_conta_id,
      (v_mov.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      v_mov.tipo,
      COALESCE(NULLIF(v_mov.categoria, ''), 'caixa'),
      v_mov.descricao,
      v_mov.valor,
      v_mov.id,
      'movimentacao_caixa',
      v_mov.unidade_id,
      'Espelho automático do caixa físico'
    )
    ON CONFLICT (conta_bancaria_id, referencia_id)
      WHERE referencia_tipo = 'movimentacao_caixa' AND referencia_id IS NOT NULL
    DO UPDATE SET
      data = EXCLUDED.data,
      tipo = EXCLUDED.tipo,
      categoria = EXCLUDED.categoria,
      descricao = EXCLUDED.descricao,
      valor = EXCLUDED.valor,
      unidade_id = EXCLUDED.unidade_id,
      updated_at = now();

    PERFORM public.recalcular_saldo_conta_bancaria(v_conta_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_espelhar_caixa_em_banco() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_espelhar_caixa_em_banco ON public.movimentacoes_caixa;
CREATE TRIGGER trg_espelhar_caixa_em_banco
AFTER INSERT OR UPDATE OF valor, tipo, status, categoria, descricao, unidade_id, created_at
   OR DELETE
ON public.movimentacoes_caixa
FOR EACH ROW EXECUTE FUNCTION public.fn_espelhar_caixa_em_banco();

-- 4) Backfill histórico (a partir do created_at da configuração de dinheiro), sem duplicar
INSERT INTO public.movimentacoes_bancarias (
  conta_bancaria_id, data, tipo, categoria, descricao, valor,
  referencia_id, referencia_tipo, unidade_id, observacoes
)
SELECT cfg.conta_bancaria_id,
       (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
       m.tipo,
       COALESCE(NULLIF(m.categoria, ''), 'caixa'),
       m.descricao,
       m.valor,
       m.id,
       'movimentacao_caixa',
       m.unidade_id,
       'Espelho automático do caixa físico (backfill)'
  FROM public.movimentacoes_caixa m
  JOIN public.config_destino_pagamento cfg
    ON cfg.forma_pagamento = 'dinheiro'
   AND cfg.ativo IS TRUE
   AND cfg.conta_bancaria_id IS NOT NULL
   AND cfg.unidade_id IS NOT DISTINCT FROM m.unidade_id
  JOIN public.contas_bancarias cb ON cb.id = cfg.conta_bancaria_id
 WHERE lower(COALESCE(m.status, '')) IN ('aprovado', 'aprovada')
   AND m.created_at >= GREATEST(cfg.created_at, cb.created_at)
ON CONFLICT (conta_bancaria_id, referencia_id)
  WHERE referencia_tipo = 'movimentacao_caixa' AND referencia_id IS NOT NULL
DO NOTHING;

-- 5) Recalcular saldo de todas as contas destino de dinheiro
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT conta_bancaria_id FROM public.config_destino_pagamento
            WHERE forma_pagamento = 'dinheiro' AND ativo IS TRUE AND conta_bancaria_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_saldo_conta_bancaria(r.conta_bancaria_id);
  END LOOP;
END;
$$;