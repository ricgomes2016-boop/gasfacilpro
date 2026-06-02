-- Harden direct reads of payment gateway keys and social OAuth tokens.
-- The frontend receives only safe metadata; edge functions/RPCs keep using service_role.

REVOKE SELECT ON public.configuracoes_empresa FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id,
  nome_empresa,
  cnpj,
  telefone,
  endereco,
  mensagem_cupom,
  created_at,
  updated_at,
  empresa_id,
  regras_bia,
  regras_cadastro,
  asaas_sandbox
) ON public.configuracoes_empresa TO authenticated;

REVOKE SELECT ON public.social_accounts FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id,
  empresa_id,
  unidade_id,
  plataforma,
  nome_conta,
  username,
  token_expires_at,
  avatar_url,
  ativo,
  created_at,
  updated_at,
  page_id,
  ig_business_id,
  scopes,
  conectado_via,
  profile_picture_url,
  external_id
) ON public.social_accounts TO authenticated;

CREATE OR REPLACE FUNCTION public.get_asaas_config_status(p_empresa_id uuid)
RETURNS TABLE (
  asaas_sandbox boolean,
  has_asaas_api_key boolean,
  has_asaas_webhook_token boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      p_empresa_id = public.get_user_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'gestor'::public.app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN query
    SELECT
      COALESCE(c.asaas_sandbox, true),
      NULLIF(c.asaas_api_key, '') IS NOT NULL,
      NULLIF(c.asaas_webhook_token, '') IS NOT NULL
    FROM public.configuracoes_empresa c
    WHERE c.empresa_id = p_empresa_id
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_asaas_config_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_asaas_config_status(uuid) TO authenticated, service_role;
