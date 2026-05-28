-- 1) Fix vale_gas_acerto_vales restrictive policy (scope subquery by empresa)
DROP POLICY IF EXISTS "tenant_isolation_vale_gas_acerto_vales" ON public.vale_gas_acerto_vales;

CREATE POLICY "tenant_isolation_vale_gas_acerto_vales"
ON public.vale_gas_acerto_vales
AS RESTRICTIVE
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR acerto_id IN (
    SELECT id FROM public.vale_gas_acertos
    WHERE unidade_id IS NULL
       OR unidade_belongs_to_user_empresa(unidade_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR acerto_id IN (
    SELECT id FROM public.vale_gas_acertos
    WHERE unidade_id IS NULL
       OR unidade_belongs_to_user_empresa(unidade_id)
  )
);

-- 2) Add restrictive tenant isolation on user_roles
DROP POLICY IF EXISTS "tenant_isolation_user_roles" ON public.user_roles;

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
  OR user_id = auth.uid()
  OR user_in_same_empresa(user_id)
);