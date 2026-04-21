-- Atualiza a policy restritiva para permitir que contadores vejam unidades das empresas vinculadas
DROP POLICY IF EXISTS tenant_isolation_unidades ON public.unidades;

CREATE POLICY tenant_isolation_unidades
ON public.unidades
AS RESTRICTIVE
FOR ALL
TO public
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (empresa_id = public.get_user_empresa_id())
  OR public.contador_has_empresa(auth.uid(), empresa_id)
);