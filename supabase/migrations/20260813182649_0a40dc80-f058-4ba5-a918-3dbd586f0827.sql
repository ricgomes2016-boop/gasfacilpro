
-- 1) CLIENTES: enforce unidade scope as RESTRICTIVE (no blanket bypass for users without unidade)
DROP POLICY IF EXISTS clientes_unidade_scope ON public.clientes;

CREATE POLICY clientes_unidade_scope_restrictive
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'entregador'::app_role)
  OR NOT EXISTS (SELECT 1 FROM public.cliente_unidades cu WHERE cu.cliente_id = clientes.id)
  OR EXISTS (
    SELECT 1 FROM public.cliente_unidades cu
    JOIN public.user_unidades uu ON uu.unidade_id = cu.unidade_id
    WHERE cu.cliente_id = clientes.id AND uu.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR NOT EXISTS (SELECT 1 FROM public.cliente_unidades cu WHERE cu.cliente_id = clientes.id)
  OR EXISTS (
    SELECT 1 FROM public.cliente_unidades cu
    JOIN public.user_unidades uu ON uu.unidade_id = cu.unidade_id
    WHERE cu.cliente_id = clientes.id AND uu.user_id = auth.uid()
  )
);

-- 2) CONCORRENTES: restrict to management roles only
CREATE OR REPLACE FUNCTION public.can_view_inteligencia_mercado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('super_admin','admin','gestor','financeiro','operacional')
  )
$$;

DROP POLICY IF EXISTS "Users can view concorrentes of their empresa" ON public.concorrentes;
DROP POLICY IF EXISTS "Users can insert concorrentes for their empresa" ON public.concorrentes;
DROP POLICY IF EXISTS "Users can update concorrentes of their empresa" ON public.concorrentes;
DROP POLICY IF EXISTS "Users can delete concorrentes of their empresa" ON public.concorrentes;
DROP POLICY IF EXISTS tenant_isolation_concorrentes ON public.concorrentes;

CREATE POLICY concorrentes_manage
ON public.concorrentes
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id())
  AND public.can_view_inteligencia_mercado(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id())
  AND public.can_view_inteligencia_mercado(auth.uid())
);

DROP POLICY IF EXISTS concorrente_precos_select ON public.concorrente_precos;
DROP POLICY IF EXISTS concorrente_precos_insert ON public.concorrente_precos;
DROP POLICY IF EXISTS concorrente_precos_delete ON public.concorrente_precos;
DROP POLICY IF EXISTS tenant_isolation_concorrente_precos ON public.concorrente_precos;

CREATE POLICY concorrente_precos_manage
ON public.concorrente_precos
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id())
  AND public.can_view_inteligencia_mercado(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role) OR empresa_id = get_user_empresa_id())
  AND public.can_view_inteligencia_mercado(auth.uid())
);
