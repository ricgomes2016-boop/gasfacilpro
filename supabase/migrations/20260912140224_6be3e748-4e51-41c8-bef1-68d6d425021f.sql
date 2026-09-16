CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Migração duplicada aposentada.
-- A estrutura foi criada por 20260912133432_pagbank_edi_secure_config.sql.
-- Mantemos este timestamp para não quebrar o histórico de ambientes que já o
-- registraram, mas sem repetir CREATE TABLE/FUNCTION/TRIGGER.
DO $$
BEGIN
  IF to_regclass('public.pagbank_edi_config') IS NULL
     OR to_regclass('public.pagbank_api_config') IS NULL THEN
    RAISE EXCEPTION
      'A migração 20260912133432_pagbank_edi_secure_config.sql deve ser aplicada antes desta';
  END IF;
END
$$;

/*
CREATE TABLE public.pagbank_edi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL UNIQUE REFERENCES public.unidades(id) ON DELETE CASCADE,
  conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  estabelecimento_id TEXT NOT NULL,
  token_secret_id UUID NOT NULL,
  token_mascara TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'configurado'
    CHECK (status IN ('aguardando_credenciais', 'configurado', 'conectado', 'erro')),
  ultima_sincronizacao_em TIMESTAMPTZ,
  ultima_data_validada DATE,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagbank_edi_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pagbank_edi_config FROM anon, authenticated;
GRANT ALL ON TABLE public.pagbank_edi_config TO service_role;

CREATE TRIGGER update_pagbank_edi_config_updated_at
  BEFORE UPDATE ON public.pagbank_edi_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pagbank_save_edi_credentials(
  p_unidade_id UUID,
  p_conta_bancaria_id UUID,
  p_estabelecimento_id TEXT,
  p_token TEXT
)
RETURNS public.pagbank_edi_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_id UUID;
  v_existing_secret UUID;
  v_row public.pagbank_edi_config;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF length(trim(p_estabelecimento_id)) < 3 OR length(trim(p_token)) < 12 THEN
    RAISE EXCEPTION 'Credenciais EDI inválidas';
  END IF;

  SELECT token_secret_id INTO v_existing_secret
  FROM public.pagbank_edi_config
  WHERE unidade_id = p_unidade_id;

  IF v_existing_secret IS NULL THEN
    SELECT vault.create_secret(
      trim(p_token),
      'pagbank-edi-' || p_unidade_id::text,
      'Token API EDI PagBank da unidade'
    ) INTO v_secret_id;
  ELSE
    PERFORM vault.update_secret(
      v_existing_secret,
      trim(p_token),
      'pagbank-edi-' || p_unidade_id::text,
      'Token API EDI PagBank da unidade'
    );
    v_secret_id := v_existing_secret;
  END IF;

  INSERT INTO public.pagbank_edi_config (
    unidade_id, conta_bancaria_id, estabelecimento_id,
    token_secret_id, token_mascara, status, ultimo_erro
  ) VALUES (
    p_unidade_id, p_conta_bancaria_id, trim(p_estabelecimento_id),
    v_secret_id, '••••' || right(trim(p_token), 4), 'configurado', NULL
  )
  ON CONFLICT (unidade_id) DO UPDATE SET
    conta_bancaria_id = EXCLUDED.conta_bancaria_id,
    estabelecimento_id = EXCLUDED.estabelecimento_id,
    token_secret_id = EXCLUDED.token_secret_id,
    token_mascara = EXCLUDED.token_mascara,
    status = 'configurado',
    ultimo_erro = NULL
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pagbank_get_edi_credentials(p_unidade_id UUID)
RETURNS TABLE (
  estabelecimento_id TEXT,
  token TEXT,
  conta_bancaria_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT c.estabelecimento_id, d.decrypted_secret, c.conta_bancaria_id
  FROM public.pagbank_edi_config c
  JOIN vault.decrypted_secrets d ON d.id = c.token_secret_id
  WHERE c.unidade_id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pagbank_save_edi_credentials(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pagbank_get_edi_credentials(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pagbank_save_edi_credentials(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pagbank_get_edi_credentials(UUID) TO service_role;

CREATE TABLE public.pagbank_api_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL UNIQUE REFERENCES public.unidades(id) ON DELETE CASCADE,
  conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
  token_secret_id UUID NOT NULL,
  token_mascara TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'configurado'
    CHECK (status IN ('configurado', 'conectado', 'erro')),
  ultimo_teste_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagbank_api_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pagbank_api_config FROM anon, authenticated;
GRANT ALL ON TABLE public.pagbank_api_config TO service_role;

CREATE TRIGGER update_pagbank_api_config_updated_at
  BEFORE UPDATE ON public.pagbank_api_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pagbank_save_api_credentials(
  p_unidade_id UUID,
  p_conta_bancaria_id UUID,
  p_ambiente TEXT,
  p_token TEXT
)
RETURNS public.pagbank_api_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_id UUID;
  v_existing_secret UUID;
  v_row public.pagbank_api_config;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_ambiente NOT IN ('sandbox', 'producao') OR length(trim(p_token)) < 12 THEN
    RAISE EXCEPTION 'Credenciais da API PagBank inválidas';
  END IF;

  SELECT token_secret_id INTO v_existing_secret
  FROM public.pagbank_api_config WHERE unidade_id = p_unidade_id;

  IF v_existing_secret IS NULL THEN
    SELECT vault.create_secret(trim(p_token), 'pagbank-api-' || p_unidade_id::text,
      'Token API Order/Pix PagBank da unidade') INTO v_secret_id;
  ELSE
    PERFORM vault.update_secret(v_existing_secret, trim(p_token),
      'pagbank-api-' || p_unidade_id::text, 'Token API Order/Pix PagBank da unidade');
    v_secret_id := v_existing_secret;
  END IF;

  INSERT INTO public.pagbank_api_config (
    unidade_id, conta_bancaria_id, ambiente, token_secret_id, token_mascara, status, ultimo_erro
  ) VALUES (
    p_unidade_id, p_conta_bancaria_id, p_ambiente, v_secret_id,
    '••••' || right(trim(p_token), 4), 'configurado', NULL
  )
  ON CONFLICT (unidade_id) DO UPDATE SET
    conta_bancaria_id = EXCLUDED.conta_bancaria_id,
    ambiente = EXCLUDED.ambiente,
    token_secret_id = EXCLUDED.token_secret_id,
    token_mascara = EXCLUDED.token_mascara,
    status = 'configurado',
    ultimo_erro = NULL
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pagbank_get_api_credentials(p_unidade_id UUID)
RETURNS TABLE (token TEXT, ambiente TEXT, conta_bancaria_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT d.decrypted_secret, c.ambiente, c.conta_bancaria_id
  FROM public.pagbank_api_config c
  JOIN vault.decrypted_secrets d ON d.id = c.token_secret_id
  WHERE c.unidade_id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pagbank_save_api_credentials(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pagbank_get_api_credentials(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pagbank_save_api_credentials(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pagbank_get_api_credentials(UUID) TO service_role;
*/
