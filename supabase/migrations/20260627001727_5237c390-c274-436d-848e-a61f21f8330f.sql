CREATE OR REPLACE FUNCTION public.fn_dispatch_push_novo_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_url text;
BEGIN
  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-novo-pedido';

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia inserção do pedido por falha de notificação
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_push_novo_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_url text;
BEGIN
  -- Apenas mensagens recebidas do cliente (não enviadas pelo sistema/operador/bot)
  IF NEW.role IN ('assistant','human','system') THEN
    RETURN NEW;
  END IF;

  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-novo-chat';

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('mensagem_id', NEW.id, 'conversa_id', NEW.conversa_id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;