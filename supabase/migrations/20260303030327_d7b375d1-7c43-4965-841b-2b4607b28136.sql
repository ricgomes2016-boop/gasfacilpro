-- Permitir registros globais (unidade_id IS NULL) sem quebrar isolamento por empresa
-- Canais de venda
DROP POLICY IF EXISTS tenant_isolation_canais_venda ON public.canais_venda;
CREATE POLICY tenant_isolation_canais_venda
ON public.canais_venda
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
);

-- Configuração de comissão
DROP POLICY IF EXISTS tenant_isolation_comissao_config ON public.comissao_config;
CREATE POLICY tenant_isolation_comissao_config
ON public.comissao_config
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
);

-- Produtos (manter compatibilidade com padrão global)
DROP POLICY IF EXISTS tenant_isolation_produtos ON public.produtos;
CREATE POLICY tenant_isolation_produtos
ON public.produtos
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
);