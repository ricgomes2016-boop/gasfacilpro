
-- Trigger function: notify admins/gestores on new pedido or status change
CREATE OR REPLACE FUNCTION public.fn_notificar_admins_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin RECORD;
  v_titulo TEXT;
  v_mensagem TEXT;
  v_tipo TEXT;
  v_link TEXT;
  v_empresa_id uuid;
BEGIN
  v_link := '/vendas/pedidos';
  
  -- Get empresa_id from the pedido's unidade
  IF NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_tipo := 'pedido';
    v_titulo := '🛵 Novo Pedido Recebido';
    v_mensagem := 'Pedido #' || UPPER(LEFT(NEW.id::text, 8)) || ' · R$ ' || COALESCE(NEW.valor_total::text, '0') || ' · ' || COALESCE(NEW.canal_venda, 'balcão');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_tipo := 'pedido';
    v_titulo := '📦 Status Atualizado';
    v_mensagem := 'Pedido #' || UPPER(LEFT(NEW.id::text, 8)) || ' → ' || COALESCE(NEW.status, 'desconhecido');
  ELSE
    RETURN NEW;
  END IF;

  -- Insert notification for all admin and gestor users of the same empresa
  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
  SELECT ur.user_id, v_tipo, v_titulo, v_mensagem, v_link
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'gestor')
    AND (v_empresa_id IS NULL OR p.empresa_id = v_empresa_id);

  RETURN NEW;
END;
$$;

-- Create trigger on pedidos table
CREATE TRIGGER trg_notificar_admins_pedido
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_notificar_admins_pedido();
