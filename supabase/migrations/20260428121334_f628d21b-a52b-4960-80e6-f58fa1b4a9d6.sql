CREATE OR REPLACE FUNCTION public.fn_notificar_admins_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_titulo TEXT;
  v_mensagem TEXT;
  v_tipo TEXT;
  v_link TEXT;
  v_empresa_id uuid;
  v_pedido_ref TEXT;
BEGIN
  v_link := '/vendas/pedidos';
  v_pedido_ref := COALESCE(NEW.numero_sequencial::text, UPPER(LEFT(NEW.id::text, 8)));
  
  IF NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_tipo := 'pedido';
    v_titulo := '🛵 Novo Pedido Recebido';
    v_mensagem := 'Pedido #' || v_pedido_ref || ' · R$ ' || COALESCE(NEW.valor_total::text, '0') || ' · ' || COALESCE(NEW.canal_venda, 'balcão');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_tipo := 'pedido';
    v_titulo := '📦 Status Atualizado';
    v_mensagem := 'Pedido #' || v_pedido_ref || ' → ' || COALESCE(NEW.status, 'desconhecido');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
  SELECT ur.user_id, v_tipo, v_titulo, v_mensagem, v_link
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'gestor')
    AND (v_empresa_id IS NULL OR p.empresa_id = v_empresa_id);

  RETURN NEW;
END;
$$;