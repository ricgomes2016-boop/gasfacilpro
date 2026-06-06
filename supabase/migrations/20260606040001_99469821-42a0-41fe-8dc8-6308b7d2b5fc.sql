
-- 1) Restringir execute_readonly_query ao service_role (corrige bypass de RLS)
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;

-- 2) plano_contas: remover políticas permissivas sem checagem de role.
-- Mantém: tenant_isolation_plano_contas (isolamento), políticas de role específicas
-- (Admin/gestor remove, Staff/contador atualiza/insere/vê, Finance staff can read).
DROP POLICY IF EXISTS "Users manage own company plano_contas" ON public.plano_contas;
DROP POLICY IF EXISTS "Users see own company plano_contas" ON public.plano_contas;

-- 3) contas_receber: remover SELECT permissivo sem checagem de role.
-- Mantém Staff can view contas_receber (admin/gestor/financeiro) + tenant_isolation_contas_receber.
DROP POLICY IF EXISTS "Contas receber isoladas por empresa" ON public.contas_receber;

-- 4) integracoes_config: remover SELECT permissivo, restringir a admin/gestor (consistente com manage).
DROP POLICY IF EXISTS "Users can view integracoes_config of their empresa units" ON public.integracoes_config;

CREATE POLICY "Admins/gestors view integracoes_config"
  ON public.integracoes_config
  FOR SELECT
  TO authenticated
  USING (
    unidade_belongs_to_user_empresa(unidade_id)
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
  );
