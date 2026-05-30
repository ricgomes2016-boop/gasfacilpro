
-- Revoke column-level SELECT on sensitive credential columns from anon and authenticated.
-- Edge functions and admin RPCs use service_role and remain unaffected.

REVOKE SELECT (certificado_a1_senha, provedor_nfe_token, nfce_csc_token)
  ON public.unidades FROM anon, authenticated, PUBLIC;

REVOKE SELECT (token, instancia_token, meta_access_token, security_token, meta_verify_token)
  ON public.integracoes_whatsapp FROM anon, authenticated, PUBLIC;

REVOKE SELECT (microsoft_refresh_token)
  ON public.transp_outlook_config FROM anon, authenticated, PUBLIC;

-- ===== SECURITY DEFINER RPCs to expose secrets only to admin/gestor users =====

CREATE OR REPLACE FUNCTION public.get_unidade_fiscal_credentials(p_unidade_id uuid)
RETURNS TABLE (
  certificado_a1_senha text,
  provedor_nfe_token text,
  nfce_csc_token text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem ler credenciais fiscais.';
  END IF;

  IF NOT public.unidade_belongs_to_user_empresa(p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: unidade fora da sua empresa.';
  END IF;

  RETURN QUERY
    SELECT u.certificado_a1_senha, u.provedor_nfe_token, u.nfce_csc_token
    FROM public.unidades u
    WHERE u.id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unidade_fiscal_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unidade_fiscal_credentials(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_whatsapp_integration_secrets(p_unidade_id uuid)
RETURNS TABLE (
  token text,
  instancia_token text,
  meta_access_token text,
  security_token text,
  meta_verify_token text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem ler credenciais do WhatsApp.';
  END IF;

  IF NOT public.unidade_belongs_to_user_empresa(p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: unidade fora da sua empresa.';
  END IF;

  RETURN QUERY
    SELECT i.token, i.instancia_token, i.meta_access_token, i.security_token, i.meta_verify_token
    FROM public.integracoes_whatsapp i
    WHERE i.unidade_id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_integration_secrets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_integration_secrets(uuid) TO authenticated, service_role;
