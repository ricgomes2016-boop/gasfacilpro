-- Lock down configuracoes_empresa: replace permissive SELECT policy with role-scoped one,
-- and revoke direct column-level SELECT on credential fields from low-privilege roles.
DROP POLICY IF EXISTS "Authenticated users can view configuracoes" ON public.configuracoes_empresa;
DROP POLICY IF EXISTS "Users can view configuracoes" ON public.configuracoes_empresa;

CREATE POLICY "Privileged users view configuracoes"
  ON public.configuracoes_empresa
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );

-- Defense in depth: revoke credential columns from authenticated/anon
REVOKE SELECT (asaas_api_key, asaas_webhook_token) ON public.configuracoes_empresa FROM authenticated, anon;

-- Lock down social_accounts: only admin/gestor can read OAuth tokens
DROP POLICY IF EXISTS social_accounts_select ON public.social_accounts;
DROP POLICY IF EXISTS "social_accounts_select" ON public.social_accounts;

CREATE POLICY social_accounts_select
  ON public.social_accounts
  FOR SELECT
  TO authenticated
  USING (
    (public.unidade_belongs_to_user_empresa(unidade_id) OR (empresa_id = public.get_user_empresa_id()))
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    )
  );

REVOKE SELECT (access_token, refresh_token) ON public.social_accounts FROM authenticated, anon;