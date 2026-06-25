
-- Fix 1: configuracoes_globais — remove blanket read to all authenticated users
DROP POLICY IF EXISTS "authenticated_read_config_globais" ON public.configuracoes_globais;

CREATE POLICY "staff_read_config_globais"
ON public.configuracoes_globais
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- Fix 2: contas_pix_chaves — replace open ALL policy with tenant-scoped + role-restricted policies
DROP POLICY IF EXISTS "Usuarios autenticados gerenciam chaves pix" ON public.contas_pix_chaves;

-- Read: any user belonging to the tenant (super_admin/admin/gestor/financeiro/operacional) + linked contadores
CREATE POLICY "tenant_read_contas_pix_chaves"
ON public.contas_pix_chaves
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.unidade_belongs_to_user_empresa(unidade_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'operacional'::app_role)
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = contas_pix_chaves.unidade_id
      AND public.contador_has_empresa(auth.uid(), u.empresa_id)
  )
);

-- Write: admin/gestor/financeiro scoped to their tenant; super_admin global
CREATE POLICY "tenant_write_contas_pix_chaves"
ON public.contas_pix_chaves
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.unidade_belongs_to_user_empresa(unidade_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.unidade_belongs_to_user_empresa(unidade_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
    )
  )
);
