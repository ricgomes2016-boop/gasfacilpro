-- =============================================================
-- Migration: melhorias_sistema_completas
-- Features:
--   1. Trigger notificação status pedido (para WhatsApp dispatch)
--   2. View conferência de caixa automática
--   3. View alerta CNH vencendo
--   4. View comissão automática do entregador
--   5. Tabela notificacoes_status_pedido (fila)
-- =============================================================

-- ============ 1. FILA DE NOTIFICAÇÕES DE STATUS ============
CREATE TABLE IF NOT EXISTS notificacoes_status_pedido (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  cliente_id UUID REFERENCES clientes(id),
  telefone TEXT,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  mensagem TEXT,
  enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_status_nao_enviado
  ON notificacoes_status_pedido(enviado, created_at)
  WHERE enviado = false;

-- Trigger: quando pedido muda de status, insere notificação na fila
CREATE OR REPLACE FUNCTION fn_notif_status_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_telefone TEXT;
  v_cliente_nome TEXT;
  v_entregador_nome TEXT;
  v_mensagem TEXT;
BEGIN
  -- Só dispara quando status muda
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  
  -- Buscar telefone do cliente
  SELECT telefone, nome INTO v_telefone, v_cliente_nome
  FROM clientes WHERE id = NEW.cliente_id;
  
  IF v_telefone IS NULL THEN RETURN NEW; END IF;
  
  -- Buscar nome do entregador se houver
  IF NEW.entregador_id IS NOT NULL THEN
    SELECT nome INTO v_entregador_nome
    FROM entregadores WHERE id = NEW.entregador_id;
  END IF;
  
  -- Montar mensagem baseada no novo status
  CASE NEW.status
    WHEN 'em_preparo' THEN
      v_mensagem := '📦 ' || COALESCE(v_cliente_nome, '') || ', seu pedido está sendo preparado!';
    WHEN 'saiu_entrega' THEN
      v_mensagem := '🚛 Seu pedido saiu para entrega!' ||
        CASE WHEN v_entregador_nome IS NOT NULL 
          THEN ' O entregador ' || v_entregador_nome || ' está a caminho.'
          ELSE '' END ||
        ' Prazo: 30 a 60 min.';
    WHEN 'entregue' THEN
      v_mensagem := '✅ Pedido entregue! Obrigado pela preferência, ' || 
        COALESCE(split_part(v_cliente_nome, ' ', 1), '') || '! 😊';
    WHEN 'cancelado' THEN
      v_mensagem := '❌ Seu pedido foi cancelado. Se precisar de algo, estamos à disposição!';
    ELSE
      RETURN NEW; -- Outros status não notificam
  END CASE;
  
  INSERT INTO notificacoes_status_pedido (
    pedido_id, cliente_id, telefone, status_anterior, status_novo, mensagem
  ) VALUES (
    NEW.id, NEW.cliente_id, v_telefone, OLD.status, NEW.status, v_mensagem
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_notif_status_pedido ON pedidos;
CREATE TRIGGER trig_notif_status_pedido
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_notif_status_pedido();


-- ============ 2. VIEW CONFERÊNCIA DE CAIXA ============
CREATE OR REPLACE VIEW vw_conferencia_caixa AS
SELECT
  cs.id AS sessao_id,
  cs.data,
  cs.status AS sessao_status,
  cs.valor_abertura,
  cs.valor_fechamento,
  cs.unidade_id,
  -- Total de entradas (pedidos entregues)
  COALESCE((
    SELECT SUM(p.valor_total)
    FROM pedidos p
    WHERE p.created_at::date = cs.data
      AND p.status = 'entregue'
      AND (p.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)
  ), 0) AS total_vendas,
  -- Entradas no caixa
  COALESCE((
    SELECT SUM(mc.valor) FROM movimentacoes_caixa mc
    WHERE mc.created_at::date = cs.data
      AND mc.tipo = 'entrada'
      AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)
  ), 0) AS total_entradas_caixa,
  -- Saídas no caixa
  COALESCE((
    SELECT SUM(mc.valor) FROM movimentacoes_caixa mc
    WHERE mc.created_at::date = cs.data
      AND mc.tipo = 'saida'
      AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)
  ), 0) AS total_saidas_caixa,
  -- Diferença (esperado vs registrado)
  cs.valor_abertura
    + COALESCE((SELECT SUM(mc.valor) FROM movimentacoes_caixa mc WHERE mc.created_at::date = cs.data AND mc.tipo = 'entrada' AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0)
    - COALESCE((SELECT SUM(mc.valor) FROM movimentacoes_caixa mc WHERE mc.created_at::date = cs.data AND mc.tipo = 'saida' AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0)
    - COALESCE(cs.valor_fechamento, 0) AS diferenca_calculada
FROM caixa_sessoes cs
ORDER BY cs.data DESC;


-- ============ 3. VIEW ALERTAS CNH ============
CREATE OR REPLACE VIEW vw_alertas_cnh AS
SELECT
  e.id,
  e.nome,
  e.cnh,
  e.cnh_vencimento,
  e.telefone,
  e.unidade_id,
  CASE
    WHEN e.cnh_vencimento < CURRENT_DATE THEN 'vencida'
    WHEN e.cnh_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'vence_30d'
    WHEN e.cnh_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN 'vence_60d'
    ELSE 'ok'
  END AS situacao,
  e.cnh_vencimento - CURRENT_DATE AS dias_restantes
FROM entregadores e
WHERE e.ativo = true
  AND e.cnh_vencimento IS NOT NULL
  AND e.cnh_vencimento <= CURRENT_DATE + INTERVAL '60 days';


-- ============ 4. VIEW COMISSÃO DO ENTREGADOR ============
CREATE OR REPLACE VIEW vw_comissao_entregador AS
SELECT
  e.id AS entregador_id,
  e.nome AS entregador_nome,
  p.unidade_id,
  DATE_TRUNC('month', p.created_at) AS mes,
  COUNT(p.id) AS total_entregas,
  SUM(p.valor_total) AS valor_total_entregas,
  COALESCE(SUM(
    CASE
      WHEN cc.valor IS NOT NULL THEN cc.valor * pi2.quantidade
      ELSE 0
    END
  ), 0) AS comissao_calculada
FROM pedidos p
JOIN entregadores e ON e.id = p.entregador_id
LEFT JOIN pedido_itens pi2 ON pi2.pedido_id = p.id
LEFT JOIN comissao_config cc ON cc.produto_id = pi2.produto_id
  AND (cc.canal_venda = p.canal_venda OR cc.canal_venda IS NULL)
  AND (cc.unidade_id = p.unidade_id OR cc.unidade_id IS NULL)
WHERE p.status = 'entregue'
GROUP BY e.id, e.nome, p.unidade_id, DATE_TRUNC('month', p.created_at);


-- ============ 5. ÍNDICE PARA AUTO-ATRIBUIÇÃO ============
CREATE INDEX IF NOT EXISTS idx_rotas_bairros ON rotas_definidas USING gin (bairros);
CREATE INDEX IF NOT EXISTS idx_entregadores_status ON entregadores(status) WHERE ativo = true;
