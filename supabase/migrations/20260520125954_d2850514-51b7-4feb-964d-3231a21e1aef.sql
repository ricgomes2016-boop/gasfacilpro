-- Tabela de assinaturas de push do navegador
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  unidade_id uuid,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_empresa ON public.push_subscriptions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_unidade ON public.push_subscriptions(unidade_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas próprias assinaturas push (select)"
ON public.push_subscriptions FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    empresa_id = public.get_user_empresa_id()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  )
);

CREATE POLICY "Usuários inserem suas próprias assinaturas push"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários atualizam suas próprias assinaturas push"
ON public.push_subscriptions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários removem suas próprias assinaturas push"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_push_subs_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger AFTER INSERT em pedidos: chama edge function send-push-novo-pedido via pg_net
CREATE OR REPLACE FUNCTION public.fn_dispatch_push_novo_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_url text;
BEGIN
  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-novo-pedido';
  PERFORM extensions.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia inserção do pedido por falha de notificação
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_dispatch_push ON public.pedidos;
CREATE TRIGGER trg_pedidos_dispatch_push
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_push_novo_pedido();