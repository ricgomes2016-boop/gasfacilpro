
-- canais_venda
DROP POLICY IF EXISTS "Entregadores can view canais_venda" ON public.canais_venda;
CREATE POLICY "Entregadores can view canais_venda" ON public.canais_venda
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'entregador'::app_role)
  AND (unidade_id IS NULL OR public.unidade_belongs_to_user_empresa(unidade_id))
);

-- operadoras_cartao
DROP POLICY IF EXISTS "Entregador visualiza operadoras_cartao" ON public.operadoras_cartao;
CREATE POLICY "Entregador visualiza operadoras_cartao" ON public.operadoras_cartao
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'entregador'::app_role)
  AND (unidade_id IS NULL OR public.unidade_belongs_to_user_empresa(unidade_id))
);

-- veiculos
DROP POLICY IF EXISTS "Entregadores can view veiculos" ON public.veiculos;
CREATE POLICY "Entregadores can view veiculos" ON public.veiculos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'entregador'::app_role)
  AND (unidade_id IS NULL OR public.unidade_belongs_to_user_empresa(unidade_id))
);

-- vale_gas SELECT
DROP POLICY IF EXISTS "Entregadores can view vale_gas" ON public.vale_gas;
CREATE POLICY "Entregadores can view vale_gas" ON public.vale_gas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'entregador'::app_role)
  AND public.unidade_belongs_to_user_empresa(unidade_id)
);

-- vale_gas UPDATE
DROP POLICY IF EXISTS "Entregadores can update vale_gas" ON public.vale_gas;
CREATE POLICY "Entregadores can update vale_gas" ON public.vale_gas
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'entregador'::app_role)
  AND public.unidade_belongs_to_user_empresa(unidade_id)
)
WITH CHECK (
  has_role(auth.uid(), 'entregador'::app_role)
  AND public.unidade_belongs_to_user_empresa(unidade_id)
);

-- configuracoes_globais: restringe leitura a super_admin (tabela realmente global, sem escopo por empresa)
DROP POLICY IF EXISTS "staff_read_config_globais" ON public.configuracoes_globais;
CREATE POLICY "super_admin_read_config_globais" ON public.configuracoes_globais
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
