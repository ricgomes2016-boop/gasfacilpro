
-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_unidade_credenciais(uuid);

-- ============ Tenant isolation policies ============
DROP POLICY IF EXISTS tenant_isolation_avaliacoes_entrega ON public.avaliacoes_entrega;
CREATE POLICY tenant_isolation_avaliacoes_entrega ON public.avaliacoes_entrega AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR entregador_id IN (
    SELECT e.id FROM public.entregadores e
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE u.empresa_id = get_user_empresa_id()
  )
  OR pedido_id IN (
    SELECT p.id FROM public.pedidos p
    JOIN public.unidades u ON u.id = p.unidade_id
    WHERE u.empresa_id = get_user_empresa_id()
  )
);

DROP POLICY IF EXISTS tenant_isolation_carregamento_rota_itens ON public.carregamento_rota_itens;
CREATE POLICY tenant_isolation_carregamento_rota_itens ON public.carregamento_rota_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR carregamento_id IN (
    SELECT cr.id FROM public.carregamentos_rota cr
    LEFT JOIN public.unidades u ON u.id = cr.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR cr.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_cliente_enderecos ON public.cliente_enderecos;
CREATE POLICY tenant_isolation_cliente_enderecos ON public.cliente_enderecos AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR cliente_id IN (SELECT id FROM public.clientes WHERE empresa_id = get_user_empresa_id())
);

DROP POLICY IF EXISTS tenant_isolation_cliente_observacoes ON public.cliente_observacoes;
CREATE POLICY tenant_isolation_cliente_observacoes ON public.cliente_observacoes AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR cliente_id IN (SELECT id FROM public.clientes WHERE empresa_id = get_user_empresa_id())
);

DROP POLICY IF EXISTS tenant_isolation_cliente_tag_associacoes ON public.cliente_tag_associacoes;
CREATE POLICY tenant_isolation_cliente_tag_associacoes ON public.cliente_tag_associacoes AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR cliente_id IN (SELECT id FROM public.clientes WHERE empresa_id = get_user_empresa_id())
);

DROP POLICY IF EXISTS tenant_isolation_compra_itens ON public.compra_itens;
CREATE POLICY tenant_isolation_compra_itens ON public.compra_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR compra_id IN (
    SELECT c.id FROM public.compras c
    LEFT JOIN public.unidades u ON u.id = c.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR c.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_devolucao_itens ON public.devolucao_itens;
CREATE POLICY tenant_isolation_devolucao_itens ON public.devolucao_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR devolucao_id IN (
    SELECT d.id FROM public.devolucoes d
    LEFT JOIN public.unidades u ON u.id = d.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR d.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_entregador_conquistas ON public.entregador_conquistas;
CREATE POLICY tenant_isolation_entregador_conquistas ON public.entregador_conquistas AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR entregador_id IN (
    SELECT e.id FROM public.entregadores e
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE u.empresa_id = get_user_empresa_id()
  )
);

DROP POLICY IF EXISTS tenant_isolation_fatura_cartao_itens ON public.fatura_cartao_itens;
CREATE POLICY tenant_isolation_fatura_cartao_itens ON public.fatura_cartao_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR fatura_id IN (
    SELECT f.id FROM public.faturas_cartao f
    LEFT JOIN public.unidades u ON u.id = f.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR f.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_folha_pagamento_itens ON public.folha_pagamento_itens;
CREATE POLICY tenant_isolation_folha_pagamento_itens ON public.folha_pagamento_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR folha_id IN (
    SELECT f.id FROM public.folhas_pagamento f
    LEFT JOIN public.unidades u ON u.id = f.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR f.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_licitacao_documentos ON public.licitacao_documentos;
CREATE POLICY tenant_isolation_licitacao_documentos ON public.licitacao_documentos AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR licitacao_id IN (
    SELECT l.id FROM public.licitacoes l
    LEFT JOIN public.unidades u ON u.id = l.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR l.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_licitacao_ocorrencias ON public.licitacao_ocorrencias;
CREATE POLICY tenant_isolation_licitacao_ocorrencias ON public.licitacao_ocorrencias AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR licitacao_id IN (
    SELECT l.id FROM public.licitacoes l
    LEFT JOIN public.unidades u ON u.id = l.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR l.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_mdfe_nfes_vinculadas ON public.mdfe_nfes_vinculadas;
CREATE POLICY tenant_isolation_mdfe_nfes_vinculadas ON public.mdfe_nfes_vinculadas AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR nfe_id IN (
    SELECT n.id FROM public.notas_fiscais n
    LEFT JOIN public.unidades u ON u.id = n.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR n.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_nota_fiscal_itens ON public.nota_fiscal_itens;
CREATE POLICY tenant_isolation_nota_fiscal_itens ON public.nota_fiscal_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR nota_fiscal_id IN (
    SELECT n.id FROM public.notas_fiscais n
    LEFT JOIN public.unidades u ON u.id = n.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR n.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_onboarding_itens ON public.onboarding_itens;
CREATE POLICY tenant_isolation_onboarding_itens ON public.onboarding_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR checklist_id IN (
    SELECT c.id FROM public.onboarding_checklists c
    LEFT JOIN public.unidades u ON u.id = c.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR c.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_orcamento_itens ON public.orcamento_itens;
CREATE POLICY tenant_isolation_orcamento_itens ON public.orcamento_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR orcamento_id IN (
    SELECT o.id FROM public.orcamentos o
    LEFT JOIN public.unidades u ON u.id = o.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR o.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_pedido_itens ON public.pedido_itens;
CREATE POLICY tenant_isolation_pedido_itens ON public.pedido_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR pedido_id IN (
    SELECT p.id FROM public.pedidos p
    LEFT JOIN public.unidades u ON u.id = p.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR p.unidade_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_rotas ON public.rotas;
CREATE POLICY tenant_isolation_rotas ON public.rotas AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR entregador_id IN (
    SELECT e.id FROM public.entregadores e
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE u.empresa_id = get_user_empresa_id()
  )
);

DROP POLICY IF EXISTS tenant_isolation_rota_historico ON public.rota_historico;
CREATE POLICY tenant_isolation_rota_historico ON public.rota_historico AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR rota_id IN (
    SELECT r.id FROM public.rotas r
    JOIN public.entregadores e ON e.id = r.entregador_id
    JOIN public.unidades u ON u.id = e.unidade_id
    WHERE u.empresa_id = get_user_empresa_id()
  )
);

DROP POLICY IF EXISTS tenant_isolation_transferencia_estoque_itens ON public.transferencia_estoque_itens;
CREATE POLICY tenant_isolation_transferencia_estoque_itens ON public.transferencia_estoque_itens AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR transferencia_id IN (
    SELECT t.id FROM public.transferencias_estoque t
    LEFT JOIN public.unidades u ON u.id = t.unidade_origem_id
    WHERE u.empresa_id = get_user_empresa_id() OR t.unidade_origem_id IS NULL
  )
);

DROP POLICY IF EXISTS tenant_isolation_transferencias_bancarias ON public.transferencias_bancarias;
CREATE POLICY tenant_isolation_transferencias_bancarias ON public.transferencias_bancarias AS RESTRICTIVE
FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR conta_origem_id IN (
    SELECT cb.id FROM public.contas_bancarias cb
    LEFT JOIN public.unidades u ON u.id = cb.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR cb.unidade_id IS NULL
  )
  OR conta_destino_id IN (
    SELECT cb.id FROM public.contas_bancarias cb
    LEFT JOIN public.unidades u ON u.id = cb.unidade_id
    WHERE u.empresa_id = get_user_empresa_id() OR cb.unidade_id IS NULL
  )
);

-- ============ UNIDADES sensitive columns ============
REVOKE SELECT (certificado_a1_senha, provedor_nfe_token, nfce_csc_token) ON public.unidades FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_unidade_credenciais(_unidade_id uuid)
RETURNS TABLE(
  certificado_a1_senha text,
  provedor_nfe_token text,
  nfce_csc_token text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
      AND unidade_belongs_to_user_empresa(_unidade_id)
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT u.certificado_a1_senha, u.provedor_nfe_token, u.nfce_csc_token
  FROM public.unidades u
  WHERE u.id = _unidade_id;
END;
$$;

-- ============ STORAGE ============
DROP POLICY IF EXISTS "Authenticated users can upload marketing assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload marketing assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'marketing-assets'
  AND (storage.foldername(name))[1] = get_user_empresa_id()::text
);

DROP POLICY IF EXISTS "Users can delete own marketing assets" ON storage.objects;
CREATE POLICY "Users can delete own marketing assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (storage.foldername(name))[1] = get_user_empresa_id()::text
  )
);

DROP POLICY IF EXISTS transp_comprovantes_delete ON storage.objects;
CREATE POLICY transp_comprovantes_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transp-comprovantes'
  AND (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
      AND (storage.foldername(name))[1] = get_user_empresa_id()::text
    )
  )
);

DROP POLICY IF EXISTS transp_comprovantes_update ON storage.objects;
CREATE POLICY transp_comprovantes_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'transp-comprovantes'
  AND (
    has_role(auth.uid(),'super_admin'::app_role)
    OR (
      (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
      AND (storage.foldername(name))[1] = get_user_empresa_id()::text
    )
  )
);
