
-- configuracoes_empresa: replace table-level SELECT with per-column SELECT excluding secrets
REVOKE SELECT ON public.configuracoes_empresa FROM authenticated, anon;
GRANT SELECT (id, nome_empresa, cnpj, telefone, endereco, mensagem_cupom, created_at, updated_at, regras_cadastro, empresa_id, asaas_sandbox, regras_bia) ON public.configuracoes_empresa TO authenticated;

-- whatsapp_gateway_instances: same treatment
REVOKE SELECT ON public.whatsapp_gateway_instances FROM authenticated, anon;
GRANT SELECT (id, empresa_id, unidade_id, instance_name, phone, status, qr_code, webhook_url, engine_url, auto_reconnect, created_at, updated_at) ON public.whatsapp_gateway_instances TO authenticated;

-- entregador_conquistas: add permissive SELECT policies
CREATE POLICY "Staff can view entregador_conquistas"
ON public.entregador_conquistas
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'operacional'::app_role)
);

CREATE POLICY "Entregador can view own conquistas"
ON public.entregador_conquistas
FOR SELECT
TO authenticated
USING (
  entregador_id IN (SELECT id FROM public.entregadores WHERE user_id = auth.uid())
);
