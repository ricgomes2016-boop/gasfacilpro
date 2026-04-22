-- Atualizar políticas RESTRICTIVE de isolamento para incluir contadores vinculados
DROP POLICY IF EXISTS tenant_isolation_contas_bancarias ON public.contas_bancarias;
CREATE POLICY tenant_isolation_contas_bancarias
ON public.contas_bancarias
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
  OR EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = contas_bancarias.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
  OR EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = contas_bancarias.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);

DROP POLICY IF EXISTS tenant_isolation_extrato_bancario ON public.extrato_bancario;
CREATE POLICY tenant_isolation_extrato_bancario
ON public.extrato_bancario
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
  OR (unidade_id IS NULL)
  OR EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = extrato_bancario.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
  OR EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = extrato_bancario.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);