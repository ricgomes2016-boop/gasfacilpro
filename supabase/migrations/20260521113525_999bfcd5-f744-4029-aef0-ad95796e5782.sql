CREATE OR REPLACE FUNCTION public.fn_dispatch_push_novo_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text;
BEGIN
  -- Apenas mensagens recebidas do cliente (não enviadas pelo sistema/operador/bot)
  IF NEW.role IN ('assistant','human','system') THEN
    RETURN NEW;
  END IF;

  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-novo-chat';
  PERFORM extensions.http_post(
    url := v_url,
    body := jsonb_build_object('mensagem_id', NEW.id, 'conversa_id', NEW.conversa_id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_dispatch_push_novo_chat ON public.ai_mensagens;
CREATE TRIGGER trg_dispatch_push_novo_chat
AFTER INSERT ON public.ai_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.fn_dispatch_push_novo_chat();