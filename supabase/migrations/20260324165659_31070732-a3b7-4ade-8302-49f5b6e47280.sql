
CREATE OR REPLACE FUNCTION public.fn_notif_status_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        COALESCE(split_part(v_cliente_nome, ' ', 1), '') || '! 😊' ||
        E'\n\nDe 1 a 5, como foi sua experiência? Sua avaliação nos ajuda a melhorar! ⭐';
    WHEN 'cancelado' THEN
      v_mensagem := '❌ Seu pedido foi cancelado. Se precisar de algo, estamos à disposição!';
    ELSE
      RETURN NEW;
  END CASE;
  INSERT INTO notificacoes_status_pedido (pedido_id, cliente_id, telefone, status_anterior, status_novo, mensagem)
  VALUES (NEW.id, NEW.cliente_id, v_telefone, OLD.status, NEW.status, v_mensagem);
  RETURN NEW;
END;
$function$;
