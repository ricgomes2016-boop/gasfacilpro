
-- =========================================================
-- 1. Column-level REVOKE on sensitive columns
-- =========================================================
REVOKE SELECT (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated, anon;

REVOKE SELECT (token, instancia_token, meta_access_token, meta_verify_token, security_token) ON public.integracoes_whatsapp FROM authenticated, anon;

REVOKE SELECT (access_token, refresh_token, token) ON public.social_accounts FROM authenticated, anon;

REVOKE SELECT (microsoft_refresh_token) ON public.transp_outlook_config FROM authenticated, anon;

REVOKE SELECT (certificado_a1_senha, nfce_csc_token, provedor_nfe_token) ON public.unidades FROM authenticated, anon;

REVOKE SELECT (api_key, session_data) ON public.whatsapp_gateway_instances FROM authenticated, anon;

-- Also revoke UPDATE on secret columns from clients (service_role bypasses column ACL)
REVOKE UPDATE (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated, anon;
REVOKE UPDATE (token, instancia_token, meta_access_token, meta_verify_token, security_token) ON public.integracoes_whatsapp FROM authenticated, anon;
REVOKE UPDATE (access_token, refresh_token, token) ON public.social_accounts FROM authenticated, anon;
REVOKE UPDATE (microsoft_refresh_token) ON public.transp_outlook_config FROM authenticated, anon;
REVOKE UPDATE (certificado_a1_senha, nfce_csc_token, provedor_nfe_token) ON public.unidades FROM authenticated, anon;
REVOKE UPDATE (api_key, session_data) ON public.whatsapp_gateway_instances FROM authenticated, anon;

-- =========================================================
-- 2. Tighten user_roles: prevent self-assignment of roles
-- =========================================================
DROP POLICY IF EXISTS "tenant_isolation_user_roles" ON public.user_roles;

CREATE POLICY "tenant_isolation_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (user_id = auth.uid())
  OR user_in_same_empresa(user_id)
)
WITH CHECK (
  -- Writes require admin/super_admin privileges; users may NOT self-assign roles
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_in_same_empresa(user_id)
    AND role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role])
  )
);

-- =========================================================
-- 3. entregador_lancamento_drafts: allow entregador to manage own drafts
-- =========================================================
CREATE POLICY "Entregador gerencia seus próprios drafts"
ON public.entregador_lancamento_drafts
FOR ALL
TO authenticated
USING (
  entregador_id IN (
    SELECT id FROM public.entregadores WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  entregador_id IN (
    SELECT id FROM public.entregadores WHERE user_id = auth.uid()
  )
);
