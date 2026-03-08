-- ==========================================
-- Automações de Estoque
-- 1. Função e trigger: comodato debita/credita estoque
-- 2. View de previsão de ruptura baseada no MCMM
-- ==========================================

-- =========================================================
-- 1. TRIGGER: Comodato movimenta estoque automaticamente
-- =========================================================

-- Função chamada após INSERT em comodatos (empréstimo → debita estoque)
CREATE OR REPLACE FUNCTION fn_comodato_debita_estoque()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Debitar estoque do produto emprestado
  UPDATE produtos
  SET estoque = GREATEST(0, estoque - NEW.quantidade)
  WHERE id = NEW.produto_id;

  -- Registrar movimentação
  INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, observacoes, unidade_id)
  VALUES (
    NEW.produto_id,
    'saida',
    NEW.quantidade,
    'Comodato emprestado (cliente: ' || (SELECT nome FROM clientes WHERE id = NEW.cliente_id LIMIT 1) || ')',
    NEW.unidade_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_comodato_emprestimo ON comodatos;
CREATE TRIGGER trig_comodato_emprestimo
AFTER INSERT ON comodatos
FOR EACH ROW
WHEN (NEW.status = 'ativo')
EXECUTE FUNCTION fn_comodato_debita_estoque();

-- ---------------------------------------------------------
-- Função chamada após UPDATE em comodatos (devolução → credita estoque)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_comodato_credita_estoque()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Só agir quando o status muda de 'ativo' para 'devolvido'
  IF OLD.status = 'ativo' AND NEW.status = 'devolvido' THEN
    -- Creditar estoque
    UPDATE produtos
    SET estoque = estoque + NEW.quantidade
    WHERE id = NEW.produto_id;

    -- Registrar movimentação
    INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, observacoes, unidade_id)
    VALUES (
      NEW.produto_id,
      'entrada',
      NEW.quantidade,
      'Devolução de comodato (cliente: ' || (SELECT nome FROM clientes WHERE id = NEW.cliente_id LIMIT 1) || ')',
      NEW.unidade_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_comodato_devolucao ON comodatos;
CREATE TRIGGER trig_comodato_devolucao
AFTER UPDATE ON comodatos
FOR EACH ROW
EXECUTE FUNCTION fn_comodato_credita_estoque();

-- =========================================================
-- 2. VIEW: Previsão de Ruptura baseada no giro de 30 dias
-- =========================================================
CREATE OR REPLACE VIEW vw_previsao_ruptura AS
WITH vendas_30d AS (
  SELECT
    pi.produto_id,
    SUM(pi.quantidade)::numeric AS total_vendido
  FROM pedido_itens pi
  JOIN pedidos pe ON pe.id = pi.pedido_id
  WHERE pe.created_at >= NOW() - INTERVAL '30 days'
    AND pe.status != 'cancelado'
  GROUP BY pi.produto_id
),
mcmm AS (
  SELECT
    p.id,
    p.nome,
    p.categoria,
    p.tipo_botijao,
    p.estoque,
    p.unidade_id,
    COALESCE(v.total_vendido, 0) / 30.0 AS giro_diario,
    -- Est. mínimo = giro_diario * 3 dias de reposição * 1.5 segurança
    CEIL(COALESCE(v.total_vendido, 0) / 30.0 * 3 * 1.5) AS estoque_minimo_calculado
  FROM produtos p
  LEFT JOIN vendas_30d v ON v.produto_id = p.id
  WHERE p.ativo = TRUE
    AND p.tipo_botijao != 'vazio'
)
SELECT
  id,
  nome,
  categoria,
  tipo_botijao,
  estoque,
  unidade_id,
  ROUND(giro_diario, 2) AS giro_diario,
  estoque_minimo_calculado,
  CASE
    WHEN giro_diario > 0
    THEN FLOOR(estoque / giro_diario)::int
    ELSE NULL
  END AS dias_ate_ruptura,
  CASE
    WHEN estoque <= 0 THEN 'sem_estoque'
    WHEN estoque <= estoque_minimo_calculado THEN 'critico'
    WHEN giro_diario > 0 AND FLOOR(estoque / giro_diario) <= 7 THEN 'alerta'
    ELSE 'ok'
  END AS situacao
FROM mcmm
ORDER BY
  CASE WHEN giro_diario > 0 THEN FLOOR(estoque / giro_diario) ELSE 9999 END ASC;

-- =========================================================
-- 3. Índices de performance para as queries de estoque
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_comodatos_status ON comodatos(status);
CREATE INDEX IF NOT EXISTS idx_comodatos_unidade ON comodatos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_produto ON movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_unidade_data ON movimentacoes_estoque(unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transferencia_itens_transf ON transferencia_estoque_itens(transferencia_id);
