-- Permitir que o contador vinculado à empresa veja XMLs (notas_fiscais)
-- 1) Atualiza a policy restritiva para incluir contador via contador_empresas
DROP POLICY IF EXISTS tenant_isolation_notas_fiscais ON public.notas_fiscais;

CREATE POLICY tenant_isolation_notas_fiscais
ON public.notas_fiscais
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
  OR public.contador_has_empresa(
       auth.uid(),
       (SELECT u.empresa_id FROM public.unidades u WHERE u.id = notas_fiscais.unidade_id)
     )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
  OR public.contador_has_empresa(
       auth.uid(),
       (SELECT u.empresa_id FROM public.unidades u WHERE u.id = notas_fiscais.unidade_id)
     )
);

-- 2) Permissive policy para SELECT por contador
DROP POLICY IF EXISTS "Contador can view notas_fiscais" ON public.notas_fiscais;

CREATE POLICY "Contador can view notas_fiscais"
ON public.notas_fiscais
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'contador'::public.app_role)
  AND public.contador_has_empresa(
        auth.uid(),
        (SELECT u.empresa_id FROM public.unidades u WHERE u.id = notas_fiscais.unidade_id)
      )
);