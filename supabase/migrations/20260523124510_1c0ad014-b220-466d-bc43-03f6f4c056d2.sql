
-- 1. integracoes_whatsapp: restringir SELECT a admin/gestor
DROP POLICY IF EXISTS "Users can view whatsapp configs of their empresa units" ON public.integracoes_whatsapp;
CREATE POLICY "Admins gestores can view whatsapp configs"
ON public.integracoes_whatsapp
FOR SELECT
TO authenticated
USING (
  unidade_belongs_to_user_empresa(unidade_id)
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

-- 2. unidades: revogar leitura das colunas sensíveis (apenas service_role acessa)
REVOKE SELECT (certificado_a1_senha, provedor_nfe_token, nfce_csc_token)
  ON public.unidades FROM authenticated, anon;

-- 3. cupons_desconto: exigir autenticação + escopo de empresa
DROP POLICY IF EXISTS "Clientes podem ler cupons ativos" ON public.cupons_desconto;
CREATE POLICY "Authenticated users can read active cupons of empresa"
ON public.cupons_desconto
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR unidade_id IS NULL
    OR unidade_belongs_to_user_empresa(unidade_id)
  )
);

-- 4. promocoes: idem
DROP POLICY IF EXISTS "Clientes podem ler promocoes ativas" ON public.promocoes;
CREATE POLICY "Authenticated users can read active promocoes of empresa"
ON public.promocoes
FOR SELECT
TO authenticated
USING (
  status = 'ativa'::text
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR unidade_id IS NULL
    OR unidade_belongs_to_user_empresa(unidade_id)
  )
);

-- 5. notificacoes_status_pedido: remover INSERT sem escopo
DROP POLICY IF EXISTS "Staff can insert notifications" ON public.notificacoes_status_pedido;
