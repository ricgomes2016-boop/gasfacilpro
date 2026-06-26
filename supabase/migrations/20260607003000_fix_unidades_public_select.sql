-- Fix unidades client access after sensitive-column hardening.
-- Authenticated users may read only non-sensitive unidade fields through RLS.

REVOKE SELECT ON public.unidades FROM anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can view unidades" ON public.unidades;
DROP POLICY IF EXISTS "Staff and assigned users can view unidades" ON public.unidades;
DROP POLICY IF EXISTS "Users can view own empresa unidades" ON public.unidades;
DROP POLICY IF EXISTS tenant_isolation_unidades ON public.unidades;

CREATE TABLE IF NOT EXISTS public.contador_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contador_user_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (contador_user_id, empresa_id)
);

CREATE OR REPLACE FUNCTION public.contador_has_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contador_empresas
    WHERE contador_user_id = _user_id
      AND empresa_id = _empresa_id
      AND ativo = true
  );
$$;

CREATE POLICY "Users can view own empresa unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (empresa_id = public.get_user_empresa_id())
  OR public.contador_has_empresa(auth.uid(), empresa_id)
);

CREATE POLICY tenant_isolation_unidades
ON public.unidades
AS RESTRICTIVE
FOR ALL
TO public
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (empresa_id = public.get_user_empresa_id())
  OR public.contador_has_empresa(auth.uid(), empresa_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (empresa_id = public.get_user_empresa_id())
  OR public.contador_has_empresa(auth.uid(), empresa_id)
);

DO $$
DECLARE
  readable_columns text;
  sensitive_columns text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO readable_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'unidades'
    AND column_name = ANY (ARRAY[
      'id', 'nome', 'tipo', 'cnpj', 'telefone', 'email', 'endereco', 'bairro', 'cidade', 'estado', 'cep',
      'ativo', 'created_at', 'updated_at', 'latitude', 'longitude', 'chave_pix', 'empresa_id',
      'bairros_atendidos', 'horario_abertura', 'horario_fechamento',
      'razao_social', 'nome_fantasia', 'inscricao_estadual', 'inscricao_estadual_st',
      'inscricao_municipal', 'cnae_principal', 'regime_tributario',
      'certificado_a1_validade', 'certificado_a1_titular',
      'nfe_ambiente', 'nfe_serie', 'nfe_proximo_numero',
      'nfce_serie', 'nfce_proximo_numero', 'nfce_csc_id',
      'cte_serie', 'cte_proximo_numero',
      'cfop_padrao_venda', 'cfop_padrao_devolucao', 'natureza_operacao_padrao',
      'aliquota_icms_padrao', 'aliquota_pis_padrao', 'aliquota_cofins_padrao', 'cst_csosn_padrao',
      'contador_nome', 'contador_crc', 'contador_telefone',
      'provedor_nfe', 'provedor_nfe_url'
    ]);

  IF readable_columns IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.unidades TO authenticated', readable_columns);
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO sensitive_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'unidades'
    AND column_name = ANY (ARRAY[
      'certificado_a1_path',
      'certificado_a1_senha',
      'provedor_nfe_token',
      'nfce_csc_token',
      'contador_email',
      'contador_cpf_cnpj'
    ]);

  IF sensitive_columns IS NOT NULL THEN
    EXECUTE format('REVOKE SELECT (%s) ON public.unidades FROM anon, authenticated, PUBLIC', sensitive_columns);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unidade_credenciais(_unidade_id uuid)
RETURNS TABLE(
  certificado_a1_senha text,
  provedor_nfe_token text,
  nfce_csc_token text,
  contador_email text,
  contador_cpf_cnpj text,
  certificado_a1_configurado boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
      AND unidade_belongs_to_user_empresa(_unidade_id)
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    u.certificado_a1_senha,
    u.provedor_nfe_token,
    u.nfce_csc_token,
    u.contador_email,
    u.contador_cpf_cnpj,
    (u.certificado_a1_path IS NOT NULL AND btrim(u.certificado_a1_path) <> '') AS certificado_a1_configurado
  FROM public.unidades u
  WHERE u.id = _unidade_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unidade_credenciais(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_unidade_certificado_status(_unidade_id uuid)
RETURNS TABLE(
  certificado_a1_configurado boolean,
  certificado_a1_validade date,
  certificado_a1_titular text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (
        has_role(auth.uid(),'admin'::app_role)
        OR has_role(auth.uid(),'gestor'::app_role)
        OR has_role(auth.uid(),'financeiro'::app_role)
      )
      AND unidade_belongs_to_user_empresa(_unidade_id)
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    (u.certificado_a1_path IS NOT NULL AND btrim(u.certificado_a1_path) <> '') AS certificado_a1_configurado,
    u.certificado_a1_validade,
    u.certificado_a1_titular
  FROM public.unidades u
  WHERE u.id = _unidade_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unidade_certificado_status(uuid) TO authenticated;
