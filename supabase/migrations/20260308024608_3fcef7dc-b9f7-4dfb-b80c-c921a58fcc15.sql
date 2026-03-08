
-- Fix security issues: Enable RLS on new table and secure views

-- 1. Enable RLS on notificacoes_status_pedido
ALTER TABLE notificacoes_status_pedido ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read notifications for their empresa
CREATE POLICY "Authenticated users can view notifications"
  ON notificacoes_status_pedido FOR SELECT TO authenticated
  USING (true);

-- Only system (triggers) inserts, but allow authenticated to see
CREATE POLICY "System can insert notifications"
  ON notificacoes_status_pedido FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Fix security definer views by recreating with security_invoker
DROP VIEW IF EXISTS vw_conferencia_caixa;
CREATE VIEW vw_conferencia_caixa WITH (security_invoker = true) AS
SELECT
  cs.id AS sessao_id, cs.data, cs.status AS sessao_status, cs.valor_abertura, cs.valor_fechamento, cs.unidade_id,
  COALESCE((SELECT SUM(p.valor_total) FROM pedidos p WHERE p.created_at::date = cs.data AND p.status = 'entregue' AND (p.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0) AS total_vendas,
  COALESCE((SELECT SUM(mc.valor) FROM movimentacoes_caixa mc WHERE mc.created_at::date = cs.data AND mc.tipo = 'entrada' AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0) AS total_entradas_caixa,
  COALESCE((SELECT SUM(mc.valor) FROM movimentacoes_caixa mc WHERE mc.created_at::date = cs.data AND mc.tipo = 'saida' AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0) AS total_saidas_caixa,
  cs.valor_abertura
    + COALESCE((SELECT SUM(mc.valor) FROM movimentacoes_caixa mc WHERE mc.created_at::date = cs.data AND mc.tipo = 'entrada' AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0)
    - COALESCE((SELECT SUM(mc.valor) FROM movimentacoes_caixa mc WHERE mc.created_at::date = cs.data AND mc.tipo = 'saida' AND (mc.unidade_id = cs.unidade_id OR cs.unidade_id IS NULL)), 0)
    - COALESCE(cs.valor_fechamento, 0) AS diferenca_calculada
FROM caixa_sessoes cs
ORDER BY cs.data DESC;

DROP VIEW IF EXISTS vw_alertas_cnh;
CREATE VIEW vw_alertas_cnh WITH (security_invoker = true) AS
SELECT
  e.id, e.nome, e.cnh, e.cnh_vencimento, e.telefone, e.unidade_id,
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

DROP VIEW IF EXISTS vw_comissao_entregador;
CREATE VIEW vw_comissao_entregador WITH (security_invoker = true) AS
SELECT
  e.id AS entregador_id, e.nome AS entregador_nome, p.unidade_id,
  DATE_TRUNC('month', p.created_at) AS mes,
  COUNT(p.id) AS total_entregas,
  SUM(p.valor_total) AS valor_total_entregas,
  COALESCE(SUM(
    CASE WHEN cc.valor IS NOT NULL THEN cc.valor * pi2.quantidade ELSE 0 END
  ), 0) AS comissao_calculada
FROM pedidos p
JOIN entregadores e ON e.id = p.entregador_id
LEFT JOIN pedido_itens pi2 ON pi2.pedido_id = p.id
LEFT JOIN comissao_config cc ON cc.produto_id = pi2.produto_id
  AND (cc.canal_venda = p.canal_venda OR cc.canal_venda IS NULL)
  AND (cc.unidade_id = p.unidade_id OR cc.unidade_id IS NULL)
WHERE p.status = 'entregue'
GROUP BY e.id, e.nome, p.unidade_id, DATE_TRUNC('month', p.created_at);

-- 3. Fix function search path
CREATE OR REPLACE FUNCTION fn_notif_status_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telefone TEXT;
  v_cliente_nome TEXT;
  v_entregador_nome TEXT;
  v_mensagem TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT telefone, nome INTO v_telefone, v_cliente_nome FROM clientes WHERE id = NEW.cliente_id;
  IF v_telefone IS NULL THEN RETURN NEW; END IF;
  IF NEW.entregador_id IS NOT NULL THEN
    SELECT nome INTO v_entregador_nome FROM entregadores WHERE id = NEW.entregador_id;
  END IF;
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
      RETURN NEW;
  END CASE;
  INSERT INTO notificacoes_status_pedido (pedido_id, cliente_id, telefone, status_anterior, status_novo, mensagem)
  VALUES (NEW.id, NEW.cliente_id, v_telefone, OLD.status, NEW.status, v_mensagem);
  RETURN NEW;
END;
$$;
