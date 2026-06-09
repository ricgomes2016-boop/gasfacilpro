-- Fix unidades client access after sensitive-column hardening.
-- Authenticated users may read only non-sensitive unidade fields through RLS.

REVOKE SELECT ON public.unidades FROM anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can view unidades" ON public.unidades;
DROP POLICY IF EXISTS "Staff and assigned users can view unidades" ON public.unidades;
DROP POLICY IF EXISTS "Users can view own empresa unidades" ON public.unidades;
DROP POLICY IF EXISTS tenant_isolation_unidades ON public.unidades;

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

GRANT SELECT (
  id, nome, tipo, cnpj, telefone, email, endereco, bairro, cidade, estado, cep,
  ativo, created_at, updated_at, latitude, longitude, chave_pix, empresa_id,
  bairros_atendidos, horario_abertura, horario_fechamento,
  razao_social, nome_fantasia, inscricao_estadual, inscricao_estadual_st,
  inscricao_municipal, cnae_principal, regime_tributario,
  certificado_a1_validade, certificado_a1_titular,
  nfe_ambiente, nfe_serie, nfe_proximo_numero,
  nfce_serie, nfce_proximo_numero, nfce_csc_id,
  cte_serie, cte_proximo_numero,
  cfop_padrao_venda, cfop_padrao_devolucao, natureza_operacao_padrao,
  aliquota_icms_padrao, aliquota_pis_padrao, aliquota_cofins_padrao, cst_csosn_padrao,
  contador_nome, contador_crc, contador_telefone,
  provedor_nfe, provedor_nfe_url
) ON public.unidades TO authenticated;

REVOKE SELECT (
  certificado_a1_path,
  certificado_a1_senha,
  provedor_nfe_token,
  nfce_csc_token,
  contador_email,
  contador_cpf_cnpj
) ON public.unidades FROM anon, authenticated, PUBLIC;

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
