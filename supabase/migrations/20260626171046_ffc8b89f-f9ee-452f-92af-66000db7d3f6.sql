
-- configuracoes_empresa
REVOKE SELECT (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated, anon;

-- integracoes_whatsapp
REVOKE SELECT (token, instancia_token, meta_access_token, meta_verify_token, security_token) ON public.integracoes_whatsapp FROM authenticated, anon;

-- social_accounts
REVOKE SELECT (access_token, refresh_token, token) ON public.social_accounts FROM authenticated, anon;

-- transp_outlook_config
REVOKE SELECT (microsoft_refresh_token) ON public.transp_outlook_config FROM authenticated, anon;

-- unidades
REVOKE SELECT (certificado_a1_senha, nfce_csc_token, provedor_nfe_token) ON public.unidades FROM authenticated, anon;

-- whatsapp_gateway_instances
REVOKE SELECT (api_key, session_data) ON public.whatsapp_gateway_instances FROM authenticated, anon;
