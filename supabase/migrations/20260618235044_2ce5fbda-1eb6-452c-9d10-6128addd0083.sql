-- Revoga leitura de colunas sensíveis para o role authenticated.
-- Service_role mantém acesso total (edge functions).

REVOKE SELECT (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated;

REVOKE SELECT (token, instancia_token, meta_access_token, meta_verify_token, security_token) ON public.integracoes_whatsapp FROM authenticated;

REVOKE SELECT (microsoft_refresh_token) ON public.transp_outlook_config FROM authenticated;

REVOKE SELECT (certificado_a1_senha, nfce_csc_token, provedor_nfe_token) ON public.unidades FROM authenticated;

REVOKE SELECT (api_key, session_data) ON public.whatsapp_gateway_instances FROM authenticated;