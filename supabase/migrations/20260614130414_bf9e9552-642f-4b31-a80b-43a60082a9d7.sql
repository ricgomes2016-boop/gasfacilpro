
-- 1) Revoke column-level SELECT on sensitive credential columns from authenticated/anon
REVOKE SELECT (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated, anon;

REVOKE SELECT (token, instancia_token, meta_access_token, meta_verify_token, security_token)
  ON public.integracoes_whatsapp FROM authenticated, anon;

REVOKE SELECT (microsoft_refresh_token) ON public.transp_outlook_config FROM authenticated, anon;

REVOKE SELECT (certificado_a1_senha, nfce_csc_token, provedor_nfe_token)
  ON public.unidades FROM authenticated, anon;

REVOKE SELECT (access_token, refresh_token, token)
  ON public.social_accounts FROM authenticated, anon;

REVOKE SELECT (api_key, session_data)
  ON public.whatsapp_gateway_instances FROM authenticated, anon;

-- 2) Restrict ai_mensagens SELECT policy to authenticated role only
DROP POLICY IF EXISTS "ai_mensagens select tenant" ON public.ai_mensagens;
CREATE POLICY "ai_mensagens select tenant"
ON public.ai_mensagens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR ((empresa_id IS NOT NULL) AND (empresa_id = public.get_user_empresa_id()))
  OR EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.empresa_id = public.get_user_empresa_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.user_id = auth.uid()
  )
);

-- 3) Fix mutable search_path on user-defined function
ALTER FUNCTION public.calcular_pontos_palpite(integer, integer, integer, integer)
  SET search_path = public;
