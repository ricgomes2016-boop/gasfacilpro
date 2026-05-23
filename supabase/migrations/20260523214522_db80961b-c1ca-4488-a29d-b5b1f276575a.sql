
-- ============================================================
-- Security hardening: restrict sensitive credentials and tokens
-- ============================================================

-- 1) transp_outlook_config: restrict to admin/gestor (Microsoft refresh token)
DROP POLICY IF EXISTS "Users view outlook config of their empresa" ON public.transp_outlook_config;
DROP POLICY IF EXISTS "Users insert outlook config for their empresa" ON public.transp_outlook_config;
DROP POLICY IF EXISTS "Users update outlook config of their empresa" ON public.transp_outlook_config;
DROP POLICY IF EXISTS "Users delete outlook config of their empresa" ON public.transp_outlook_config;

CREATE POLICY "Admin/Gestor view outlook config"
  ON public.transp_outlook_config FOR SELECT
  USING (
    user_belongs_to_empresa(auth.uid(), empresa_id)
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "Admin/Gestor insert outlook config"
  ON public.transp_outlook_config FOR INSERT
  WITH CHECK (
    user_belongs_to_empresa(auth.uid(), empresa_id)
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "Admin/Gestor update outlook config"
  ON public.transp_outlook_config FOR UPDATE
  USING (
    user_belongs_to_empresa(auth.uid(), empresa_id)
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "Admin/Gestor delete outlook config"
  ON public.transp_outlook_config FOR DELETE
  USING (
    user_belongs_to_empresa(auth.uid(), empresa_id)
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

-- 2) whatsapp_gateway_instances: restrict to admin/gestor (api_key, session_data, webhook_secret)
DROP POLICY IF EXISTS "Users can view own empresa instances" ON public.whatsapp_gateway_instances;
DROP POLICY IF EXISTS "Admins can manage own empresa instances" ON public.whatsapp_gateway_instances;

CREATE POLICY "Admin/Gestor view whatsapp gateway instances"
  ON public.whatsapp_gateway_instances FOR SELECT
  USING (
    (empresa_id = get_user_empresa_id() OR has_role(auth.uid(),'super_admin'::app_role))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "Admin/Gestor manage whatsapp gateway instances"
  ON public.whatsapp_gateway_instances FOR ALL
  USING (
    (empresa_id = get_user_empresa_id() OR has_role(auth.uid(),'super_admin'::app_role))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  )
  WITH CHECK (
    (empresa_id = get_user_empresa_id() OR has_role(auth.uid(),'super_admin'::app_role))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

-- 3) configuracoes_empresa: remove financeiro from SELECT (asaas_api_key et al)
DROP POLICY IF EXISTS "Privileged users view configuracoes" ON public.configuracoes_empresa;

CREATE POLICY "Privileged users view configuracoes"
  ON public.configuracoes_empresa FOR SELECT
  USING (
    has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gestor'::app_role)
  );

-- 4) unidades: drop the cross-empresa-leaking SELECT policy that grants cliente/parceiro
--    access regardless of empresa scoping. tenant_isolation_unidades remains for within-empresa.
DROP POLICY IF EXISTS "Staff and assigned users can view unidades" ON public.unidades;

-- 4b) Restrict sensitive credential columns on unidades. Revoke column-level SELECT
--     from authenticated and expose via SECURITY DEFINER RPC restricted to admin/gestor.
REVOKE SELECT (certificado_a1_senha, provedor_nfe_token, nfce_csc_token, contador_email, contador_cpf_cnpj)
  ON public.unidades FROM authenticated;
REVOKE UPDATE (certificado_a1_senha, provedor_nfe_token, nfce_csc_token, contador_email, contador_cpf_cnpj)
  ON public.unidades FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_unidade_credenciais(_unidade_id uuid)
RETURNS TABLE (
  id uuid,
  certificado_a1_senha text,
  provedor_nfe_token text,
  nfce_csc_token text,
  contador_email text,
  contador_cpf_cnpj text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gestor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR unidade_belongs_to_user_empresa(_unidade_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT u.id, u.certificado_a1_senha, u.provedor_nfe_token,
           u.nfce_csc_token, u.contador_email, u.contador_cpf_cnpj
    FROM public.unidades u
    WHERE u.id = _unidade_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_unidade_credenciais(
  _unidade_id uuid,
  _certificado_a1_senha text DEFAULT NULL,
  _provedor_nfe_token text DEFAULT NULL,
  _nfce_csc_token text DEFAULT NULL,
  _contador_email text DEFAULT NULL,
  _contador_cpf_cnpj text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gestor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR unidade_belongs_to_user_empresa(_unidade_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.unidades
     SET certificado_a1_senha = COALESCE(_certificado_a1_senha, certificado_a1_senha),
         provedor_nfe_token   = COALESCE(_provedor_nfe_token,   provedor_nfe_token),
         nfce_csc_token       = COALESCE(_nfce_csc_token,       nfce_csc_token),
         contador_email       = COALESCE(_contador_email,       contador_email),
         contador_cpf_cnpj    = COALESCE(_contador_cpf_cnpj,    contador_cpf_cnpj)
   WHERE id = _unidade_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unidade_credenciais(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_unidade_credenciais(uuid,text,text,text,text,text) TO authenticated;
