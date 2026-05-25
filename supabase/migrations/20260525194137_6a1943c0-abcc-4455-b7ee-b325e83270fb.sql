
DROP FUNCTION IF EXISTS public.get_unidade_credenciais(uuid);

CREATE OR REPLACE FUNCTION public.get_unidade_credenciais(_unidade_id uuid)
RETURNS TABLE(
  certificado_a1_senha text,
  provedor_nfe_token text,
  nfce_csc_token text,
  contador_email text,
  contador_cpf_cnpj text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
      AND unidade_belongs_to_user_empresa(_unidade_id)
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT u.certificado_a1_senha, u.provedor_nfe_token, u.nfce_csc_token, u.contador_email, u.contador_cpf_cnpj
  FROM public.unidades u
  WHERE u.id = _unidade_id;
END;
$$;
