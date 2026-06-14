-- Harden portal do vendedor: identidade por auth user_id e policies com escopo SaaS.

ALTER TABLE public.vendedor_metas
  ADD COLUMN IF NOT EXISTS empresa_id UUID,
  ADD COLUMN IF NOT EXISTS unidade_id UUID,
  ADD COLUMN IF NOT EXISTS funcionario_id UUID;

UPDATE public.vendedor_metas vm
SET
  unidade_id = COALESCE(vm.unidade_id, f.unidade_id),
  empresa_id = COALESCE(vm.empresa_id, u.empresa_id)
FROM public.funcionarios f
LEFT JOIN public.unidades u ON u.id = f.unidade_id
WHERE vm.funcionario_id = f.id
  AND (vm.unidade_id IS NULL OR vm.empresa_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_vendedor_metas_user_id ON public.vendedor_metas(user_id);
CREATE INDEX IF NOT EXISTS idx_vendedor_metas_empresa ON public.vendedor_metas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendedor_metas_unidade ON public.vendedor_metas(unidade_id);

ALTER TABLE public.vendedor_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendedor lê própria meta" ON public.vendedor_metas;
DROP POLICY IF EXISTS "Admins gerenciam metas vendedor" ON public.vendedor_metas;
DROP POLICY IF EXISTS "vendedor_metas_select_scoped" ON public.vendedor_metas;
DROP POLICY IF EXISTS "vendedor_metas_manage_scoped" ON public.vendedor_metas;

CREATE POLICY "vendedor_metas_select_scoped"
ON public.vendedor_metas
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
    AND (
      empresa_id = public.get_user_empresa_id()
      OR (unidade_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id))
    )
  )
);

CREATE POLICY "vendedor_metas_manage_scoped"
ON public.vendedor_metas
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
    AND (
      empresa_id = public.get_user_empresa_id()
      OR (unidade_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id))
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor'::public.app_role))
    AND (
      empresa_id = public.get_user_empresa_id()
      OR (unidade_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id))
    )
  )
);

-- Leitura explicita dos proprios pedidos do vendedor, sem depender de policies amplas.
DROP POLICY IF EXISTS "Vendedores veem próprios pedidos" ON public.pedidos;
CREATE POLICY "Vendedores veem próprios pedidos"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid()
  AND public.has_role(auth.uid(), 'vendedor'::public.app_role)
);

DROP POLICY IF EXISTS "Vendedores criam pedidos próprios" ON public.pedidos;
CREATE POLICY "Vendedores criam pedidos próprios"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid()
  AND public.has_role(auth.uid(), 'vendedor'::public.app_role)
  AND (
    empresa_id = public.get_user_empresa_id()
    OR (unidade_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id))
  )
);

DROP POLICY IF EXISTS "Vendedores criam itens dos próprios pedidos" ON public.pedido_itens;
CREATE POLICY "Vendedores criam itens dos próprios pedidos"
ON public.pedido_itens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.id = pedido_itens.pedido_id
      AND p.vendedor_id = auth.uid()
      AND (
        p.empresa_id = public.get_user_empresa_id()
        OR (p.unidade_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(p.unidade_id))
      )
  )
);

-- Avisos do RH tambem podem ser usados pelo portal do vendedor.
DROP POLICY IF EXISTS "Vendedores can view active RH avisos" ON public.rh_avisos_entregador;
CREATE POLICY "Vendedores can view active RH avisos"
ON public.rh_avisos_entregador
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'vendedor'::public.app_role)
  AND ativo = true
  AND (exibir_de IS NULL OR exibir_de <= now())
  AND (exibir_ate IS NULL OR exibir_ate >= now())
  AND (
    empresa_id = public.get_user_empresa_id()
    OR (unidade_id IS NOT NULL AND public.unidade_belongs_to_user_empresa(unidade_id))
  )
);
