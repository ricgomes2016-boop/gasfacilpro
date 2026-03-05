
-- =====================================================
-- SECURITY HARDENING: Add RESTRICTIVE tenant isolation
-- to tables missing it + fix open SELECT policies
-- =====================================================

-- 1. user_roles: Restrict admin role management to same empresa
-- Admin from Empresa A must NOT manage roles of Empresa B users
CREATE OR REPLACE FUNCTION public.user_in_same_empresa(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      SELECT p1.empresa_id = p2.empresa_id
      FROM profiles p1, profiles p2
      WHERE p1.user_id = auth.uid() AND p2.user_id = _target_user_id
    )
    OR auth.uid() = _target_user_id
$$;

CREATE POLICY "tenant_isolation_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR user_in_same_empresa(user_id)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_in_same_empresa(user_id)
);

-- 2. recompra_dispatches: Fix open SELECT (was `true`)
DROP POLICY IF EXISTS "Authenticated users can view dispatches" ON public.recompra_dispatches;

CREATE POLICY "tenant_isolation_recompra_dispatches"
ON public.recompra_dispatches
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
);

-- 3. alcadas_aprovacao: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_alcadas_aprovacao"
ON public.alcadas_aprovacao
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 4. aprovacoes: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_aprovacoes"
ON public.aprovacoes
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 5. concorrentes: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_concorrentes"
ON public.concorrentes
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 6. concorrente_precos: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_concorrente_precos"
ON public.concorrente_precos
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 7. fechamentos_mensais: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_fechamentos_mensais"
ON public.fechamentos_mensais
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 8. fechamento_checklist: Add restrictive tenant isolation (via fechamento)
CREATE POLICY "tenant_isolation_fechamento_checklist"
ON public.fechamento_checklist
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM fechamentos_mensais f
    WHERE f.id = fechamento_checklist.fechamento_id
    AND f.empresa_id = get_user_empresa_id()
  )
);

-- 9. integracoes_whatsapp: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_integracoes_whatsapp"
ON public.integracoes_whatsapp
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
);

-- 10. lotes_produto: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_lotes_produto"
ON public.lotes_produto
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 11. rastreio_lote: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_rastreio_lote"
ON public.rastreio_lote
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM lotes_produto l
    WHERE l.id = rastreio_lote.lote_id
    AND l.empresa_id = get_user_empresa_id()
  )
);

-- 12. politicas_cobranca: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_politicas_cobranca"
ON public.politicas_cobranca
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 13. sla_config: Add restrictive tenant isolation
CREATE POLICY "tenant_isolation_sla_config"
ON public.sla_config
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR empresa_id = get_user_empresa_id()
);

-- 14. empresas: Add restrictive isolation (view own only)
CREATE POLICY "tenant_isolation_empresas"
ON public.empresas
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR id = get_user_empresa_id()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR id = get_user_empresa_id()
);
