
-- Store internal push secret so triggers can send it
INSERT INTO public.configuracoes_globais (chave, valor, descricao)
VALUES ('internal_push_secret', to_jsonb('fejVRqvSwslC7t7odJgp4XJKLGdpVJYq-bYmr2_RuKaOGzl_W56EW4l884j5mECN'::text), 'Secret shared entre triggers e edge functions de push')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();

-- Update dispatch triggers to send x-internal-secret header
CREATE OR REPLACE FUNCTION public.fn_dispatch_push_novo_chat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF NEW.role IN ('assistant','human','system') THEN
    RETURN NEW;
  END IF;
  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-novo-chat';
  SELECT (valor #>> '{}') INTO v_secret FROM public.configuracoes_globais WHERE chave = 'internal_push_secret';
  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('mensagem_id', NEW.id, 'conversa_id', NEW.conversa_id),
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', COALESCE(v_secret,''))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_push_novo_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  v_url := 'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/send-push-novo-pedido';
  SELECT (valor #>> '{}') INTO v_secret FROM public.configuracoes_globais WHERE chave = 'internal_push_secret';
  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id),
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', COALESCE(v_secret,''))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_push_nova_entrega()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_url text;
  v_secret text;
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
  SELECT (valor #>> '{}') INTO v_secret FROM public.configuracoes_globais WHERE chave = 'internal_push_secret';
  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id),
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', COALESCE(v_secret,''))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- ============ cliente_creditos / cliente_indicacoes: scope to caller's empresa ============
DROP POLICY IF EXISTS "Clientes can view their own credits" ON public.cliente_creditos;
CREATE POLICY "Clientes can view their own credits"
ON public.cliente_creditos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles pr ON pr.user_id = u.id
    JOIN public.clientes c ON c.empresa_id = pr.empresa_id AND c.empresa_id = cliente_creditos.empresa_id
    WHERE u.id = auth.uid()
      AND c.id = cliente_creditos.cliente_id
      AND (
        ((u.email_confirmed_at IS NOT NULL) AND (c.email IS NOT NULL) AND (u.email IS NOT NULL) AND (lower(c.email) = lower(u.email::text)))
        OR ((u.phone_confirmed_at IS NOT NULL) AND (c.telefone IS NOT NULL) AND (u.phone IS NOT NULL) AND (regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g')))
      )
  )
);

DROP POLICY IF EXISTS "Clientes can view their own referrals" ON public.cliente_indicacoes;
CREATE POLICY "Clientes can view their own referrals"
ON public.cliente_indicacoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles pr ON pr.user_id = u.id
    JOIN public.clientes c ON c.empresa_id = pr.empresa_id AND c.empresa_id = cliente_indicacoes.empresa_id
    WHERE u.id = auth.uid()
      AND (c.id = cliente_indicacoes.indicador_cliente_id OR c.id = cliente_indicacoes.indicado_cliente_id)
      AND (
        ((u.email_confirmed_at IS NOT NULL) AND (c.email IS NOT NULL) AND (u.email IS NOT NULL) AND (lower(c.email) = lower(u.email::text)))
        OR ((u.phone_confirmed_at IS NOT NULL) AND (c.telefone IS NOT NULL) AND (u.phone IS NOT NULL) AND (regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g')))
      )
  )
);

-- ============ empresas: restrict INSERT to super_admin only ============
DROP POLICY IF EXISTS "Authenticated admin can create empresa" ON public.empresas;
-- Only super_admin can create new empresa records (existing "Super admin can insert empresas" policy remains)

-- ============ user_roles: restrict admin role assignments ============
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_in_same_empresa(user_id)
  AND role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role, 'gestor'::app_role, 'financeiro'::app_role])
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_in_same_empresa(user_id)
  AND role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role, 'gestor'::app_role, 'financeiro'::app_role])
);
