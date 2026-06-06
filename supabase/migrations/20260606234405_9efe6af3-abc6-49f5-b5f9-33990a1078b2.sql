
-- =====================================================================
-- Security hardening: protect sensitive secret columns and tighten RLS
-- =====================================================================

-- 1) Asaas API keys — only service_role can read these columns
REVOKE SELECT (asaas_api_key, asaas_webhook_token)
  ON public.configuracoes_empresa FROM anon, authenticated;

-- 3) WhatsApp integration tokens
REVOKE SELECT (token, instancia_token, security_token, meta_access_token, meta_verify_token)
  ON public.integracoes_whatsapp FROM anon, authenticated;

-- 5) Social media OAuth tokens
REVOKE SELECT (token, refresh_token, access_token)
  ON public.social_accounts FROM anon, authenticated;

-- 6) Microsoft Outlook refresh token
REVOKE SELECT (microsoft_refresh_token)
  ON public.transp_outlook_config FROM anon, authenticated;

-- 7) Digital certificate password (A1)
REVOKE SELECT (certificado_a1_senha, certificado_a1_path)
  ON public.unidades FROM anon, authenticated;

-- 9) WhatsApp gateway credentials
REVOKE SELECT (api_key, webhook_secret, session_data)
  ON public.whatsapp_gateway_instances FROM anon, authenticated;

-- =====================================================================
-- RLS tightening
-- =====================================================================

-- 2) entregador_conquistas: drop overly broad permissive policy
DROP POLICY IF EXISTS "Read entregador_conquistas scoped" ON public.entregador_conquistas;

-- 4) pedidos: tighten unassigned-pending view policy to require tenant context
DROP POLICY IF EXISTS "Entregadores can view unassigned pendente pedidos" ON public.pedidos;
CREATE POLICY "Entregadores can view unassigned pendente pedidos"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'entregador'::app_role)
    AND status = 'pendente'
    AND entregador_id IS NULL
    AND unidade_id IS NOT NULL
    AND unidade_belongs_to_user_empresa(unidade_id)
  );

-- 8) user_roles: prevent admins from assigning super_admin or admin roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND role NOT IN ('super_admin'::app_role, 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND role NOT IN ('super_admin'::app_role, 'admin'::app_role)
    AND user_in_same_empresa(user_id)
  );
