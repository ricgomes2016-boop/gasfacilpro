
-- 1) alcadas_aprovacao: restrict read to staff roles only
DROP POLICY IF EXISTS "Alcadas: empresa" ON public.alcadas_aprovacao;
CREATE POLICY "Alcadas: staff manage"
ON public.alcadas_aprovacao
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_empresa_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  )
)
WITH CHECK (
  empresa_id = get_user_empresa_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  )
);

-- 2) config_destino_pagamento: restrict writes/reads to finance staff
DROP POLICY IF EXISTS "Usuários autenticados podem ver config destino" ON public.config_destino_pagamento;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir config destino" ON public.config_destino_pagamento;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar config destino" ON public.config_destino_pagamento;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar config destino" ON public.config_destino_pagamento;

CREATE POLICY "Staff manage config destino pagamento"
ON public.config_destino_pagamento
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
);

-- 3) entregador_conquistas: remove true read, scope to own entregador rows
DROP POLICY IF EXISTS "Authenticated can read entregador_conquistas" ON public.entregador_conquistas;
CREATE POLICY "Read entregador_conquistas scoped"
ON public.entregador_conquistas
FOR SELECT
TO authenticated
USING (
  entregador_id IN (SELECT id FROM public.entregadores)
);

-- 4) funcionario_diarias: add role restriction (admin/gestor/financeiro/operacional)
DROP POLICY IF EXISTS "Diarias select empresa" ON public.funcionario_diarias;
DROP POLICY IF EXISTS "Diarias insert empresa" ON public.funcionario_diarias;
DROP POLICY IF EXISTS "Diarias update empresa" ON public.funcionario_diarias;
DROP POLICY IF EXISTS "Diarias delete empresa" ON public.funcionario_diarias;

CREATE POLICY "Diarias staff manage"
ON public.funcionario_diarias
FOR ALL
TO authenticated
USING (
  ((unidade_id IS NULL) OR unidade_belongs_to_user_empresa(unidade_id))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'operacional'::app_role)
  )
)
WITH CHECK (
  ((unidade_id IS NULL) OR unidade_belongs_to_user_empresa(unidade_id))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'operacional'::app_role)
  )
);

-- 5) integracoes_whatsapp: add WITH CHECK on tenant isolation restrictive policy
DROP POLICY IF EXISTS tenant_isolation_integracoes_whatsapp ON public.integracoes_whatsapp;
CREATE POLICY tenant_isolation_integracoes_whatsapp
ON public.integracoes_whatsapp
AS RESTRICTIVE
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_belongs_to_user_empresa(unidade_id)
);

-- 6) movimentacoes_bancarias: restrict to finance staff
DROP POLICY IF EXISTS "Authenticated users can view movimentacoes" ON public.movimentacoes_bancarias;
DROP POLICY IF EXISTS "Authenticated users can insert movimentacoes" ON public.movimentacoes_bancarias;
DROP POLICY IF EXISTS "Authenticated users can update movimentacoes" ON public.movimentacoes_bancarias;
DROP POLICY IF EXISTS "Authenticated users can delete movimentacoes" ON public.movimentacoes_bancarias;

CREATE POLICY "Staff manage movimentacoes_bancarias"
ON public.movimentacoes_bancarias
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
);

-- 7) pagamentos_cartao: restrict INSERT to staff roles
DROP POLICY IF EXISTS "Autenticados inserem pagamentos" ON public.pagamentos_cartao;
CREATE POLICY "Staff insert pagamentos_cartao"
ON public.pagamentos_cartao
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'operacional'::app_role)
);

-- 8) produtos: drop catch-all true read; rely on empresa-scoped policies
DROP POLICY IF EXISTS "Authenticated users can view produtos" ON public.produtos;
