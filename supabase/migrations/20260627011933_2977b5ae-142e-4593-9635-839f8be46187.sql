CREATE OR REPLACE FUNCTION public.fn_dispatch_push_nova_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_url text;
  v_should_notify boolean := false;
BEGIN
  IF NEW.entregador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_should_notify := NEW.status IS NULL OR NEW.status NOT IN ('entregue', 'cancelado');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify :=
      OLD.entregador_id IS DISTINCT FROM NEW.entregador_id
      OR (
        OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('em_rota', 'saiu_entrega')
      );
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-nova-entrega';

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pedidos_dispatch_nova_entrega ON public.pedidos;
CREATE TRIGGER trg_pedidos_dispatch_nova_entrega
AFTER INSERT OR UPDATE OF entregador_id, status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_push_nova_entrega();