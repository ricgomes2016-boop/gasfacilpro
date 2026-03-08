-- ============================================================
-- AUTOMAÇÃO FINANCEIRA — GasFácil Pro
-- 1) Trigger: conta paga → movimentação bancária automática
-- 2) Função: marcar contas vencidas (chamada pelo cron diário)
-- 3) Índices de performance nas tabelas financeiras
-- ============================================================

-- ============================================================
-- 1) FUNÇÃO E TRIGGER: conta paga → movimentação bancária
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_conta_paga_registra_saida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só age quando status muda de qualquer valor para 'paga'
  IF NEW.status = 'paga' AND (OLD.status IS DISTINCT FROM 'paga') THEN
    INSERT INTO public.movimentacoes_bancarias (
      tipo,
      descricao,
      valor,
      data,
      categoria,
      unidade_id,
      created_at
    ) VALUES (
      'saida',
      COALESCE('Pgto: ' || NEW.fornecedor || ' — ' || NEW.descricao, 'Conta paga'),
      NEW.valor,
      CURRENT_DATE,
      COALESCE(NEW.categoria, 'Fornecedores'),
      NEW.unidade_id,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir para permitir re-aplicação
DROP TRIGGER IF EXISTS trig_conta_pagar_quitada ON public.contas_pagar;

CREATE TRIGGER trig_conta_pagar_quitada
  AFTER UPDATE ON public.contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_conta_paga_registra_saida();

-- ============================================================
-- 2) FUNÇÃO: marcar contas vencidas (chamada pelo cron / edge fn)
-- ============================================================

CREATE OR REPLACE FUNCTION public.marcar_contas_vencidas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pagar  INTEGER;
  v_receber INTEGER;
BEGIN
  -- Atualiza contas a pagar vencidas
  UPDATE public.contas_pagar
  SET status = 'vencida'
  WHERE status = 'pendente'
    AND vencimento < CURRENT_DATE;

  GET DIAGNOSTICS v_pagar = ROW_COUNT;

  -- Atualiza contas a receber vencidas
  UPDATE public.contas_receber
  SET status = 'vencida'
  WHERE status = 'pendente'
    AND vencimento < CURRENT_DATE;

  GET DIAGNOSTICS v_receber = ROW_COUNT;

  RETURN jsonb_build_object(
    'contas_pagar_atualizadas', v_pagar,
    'contas_receber_atualizadas', v_receber,
    'executado_em', now()
  );
END;
$$;

-- Permissão para invocar via Edge Function (service_role)
GRANT EXECUTE ON FUNCTION public.marcar_contas_vencidas() TO service_role;

-- ============================================================
-- 3) ÍNDICES DE PERFORMANCE
-- ============================================================

-- contas_pagar
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status
  ON public.contas_pagar (status);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento
  ON public.contas_pagar (vencimento);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_unidade_status
  ON public.contas_pagar (unidade_id, status);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento_status
  ON public.contas_pagar (vencimento, status)
  WHERE status IN ('pendente', 'vencida');

-- contas_receber
CREATE INDEX IF NOT EXISTS idx_contas_receber_status
  ON public.contas_receber (status);

CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento
  ON public.contas_receber (vencimento);

CREATE INDEX IF NOT EXISTS idx_contas_receber_unidade_status
  ON public.contas_receber (unidade_id, status);

CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento_status
  ON public.contas_receber (vencimento, status)
  WHERE status IN ('pendente', 'vencida');

-- movimentacoes_bancarias
CREATE INDEX IF NOT EXISTS idx_movimentacoes_bancarias_data
  ON public.movimentacoes_bancarias (data);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_bancarias_unidade_data
  ON public.movimentacoes_bancarias (unidade_id, data);
