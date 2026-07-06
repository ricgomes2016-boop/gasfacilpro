
DO $$
DECLARE
  v_empresa uuid := 'c94c210b-8dbd-4d91-914e-2db146b8cf94';
  v_cutoff timestamptz := '2026-07-01 00:00:00+00';
  v_cutoff_date date := '2026-07-01';
  v_pedidos uuid[];
  v_vale_gas uuid[];
  v_vas uuid[];
  v_nfs uuid[];
BEGIN
  SELECT array_agg(id) INTO v_pedidos FROM public.pedidos
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  v_pedidos := COALESCE(v_pedidos, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_vale_gas FROM public.vale_gas
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  v_vale_gas := COALESCE(v_vale_gas, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_vas FROM public.vendas_antecipadas
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  v_vas := COALESCE(v_vas, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_nfs FROM public.notas_fiscais
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  v_nfs := COALESCE(v_nfs, ARRAY[]::uuid[]);

  -- Nullify references (preserve rows)
  UPDATE public.cliente_creditos    SET pedido_id=NULL           WHERE pedido_id = ANY(v_pedidos);
  UPDATE public.cliente_indicacoes  SET primeiro_pedido_id=NULL  WHERE primeiro_pedido_id = ANY(v_pedidos);
  UPDATE public.chat_mensagens      SET pedido_id=NULL           WHERE pedido_id = ANY(v_pedidos);
  UPDATE public.chamadas_recebidas  SET pedido_gerado_id=NULL    WHERE pedido_gerado_id = ANY(v_pedidos);
  UPDATE public.vendas_antecipadas  SET pedido_utilizacao_id=NULL WHERE pedido_utilizacao_id = ANY(v_pedidos);
  UPDATE public.vale_gas            SET venda_id=NULL            WHERE venda_id = ANY(v_pedidos);

  -- Delete direct children of pedidos
  DELETE FROM public.notificacoes_status_pedido WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.avaliacoes_entrega  WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.comprovantes_entrega WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.rastreio_lote       WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.cheques             WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.devolucao_itens WHERE devolucao_id IN (SELECT id FROM public.devolucoes WHERE pedido_id = ANY(v_pedidos));
  DELETE FROM public.devolucoes          WHERE pedido_id = ANY(v_pedidos);

  -- Vale gas acerto vales
  DELETE FROM public.vale_gas_acerto_vales
   WHERE acerto_id IN (SELECT id FROM public.vale_gas_acertos
                       WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
                         AND created_at < v_cutoff)
      OR vale_id = ANY(v_vale_gas);

  -- Vendas antecipadas filhos
  DELETE FROM public.vendas_antecipadas_vales WHERE venda_antecipada_id = ANY(v_vas) OR pedido_id = ANY(v_pedidos);
  DELETE FROM public.vendas_antecipadas_itens WHERE venda_antecipada_id = ANY(v_vas);
  DELETE FROM public.vendas_antecipadas       WHERE id = ANY(v_vas);

  -- NF filhos
  DELETE FROM public.mdfe_nfes_vinculadas WHERE nfe_id = ANY(v_nfs) OR mdfe_id = ANY(v_nfs);
  DELETE FROM public.nota_fiscal_itens    WHERE nota_fiscal_id = ANY(v_nfs);
  DELETE FROM public.notas_fiscais        WHERE id = ANY(v_nfs);

  -- Cartão
  DELETE FROM public.conferencia_cartao
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  DELETE FROM public.conferencia_cartao WHERE pedido_id = ANY(v_pedidos);

  DELETE FROM public.pagamentos_cartao
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  DELETE FROM public.pagamentos_cartao WHERE pedido_id = ANY(v_pedidos);

  -- Boletos ligados a contas_receber alvo
  DELETE FROM public.boletos_emitidos
   WHERE conta_receber_id IN (
     SELECT id FROM public.contas_receber
     WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
       AND created_at < v_cutoff
   ) OR conta_receber_id IN (
     SELECT id FROM public.contas_receber WHERE pedido_id = ANY(v_pedidos)
   );

  -- Pagamentos de cartão ligados a contas_receber alvo (segurança)
  DELETE FROM public.pagamentos_cartao WHERE conta_receber_id IN (
    SELECT id FROM public.contas_receber
    WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
      AND created_at < v_cutoff
  );

  DELETE FROM public.contas_receber
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  DELETE FROM public.contas_receber WHERE pedido_id = ANY(v_pedidos);

  -- Vale gas + lotes
  UPDATE public.contas_receber SET vale_gas_id=NULL WHERE vale_gas_id = ANY(v_vale_gas);
  DELETE FROM public.vale_gas WHERE id = ANY(v_vale_gas);
  DELETE FROM public.vale_gas_lotes
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;

  -- Caixa
  DELETE FROM public.movimentacoes_caixa
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  DELETE FROM public.movimentacoes_caixa WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.caixa_sessoes
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND data < v_cutoff_date;

  -- Bancos
  DELETE FROM public.movimentacoes_bancarias
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  DELETE FROM public.extrato_bancario
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa)
     AND created_at < v_cutoff;
  DELETE FROM public.extrato_bancario WHERE pedido_id = ANY(v_pedidos);

  -- Pedidos
  DELETE FROM public.pedido_itens WHERE pedido_id = ANY(v_pedidos);
  DELETE FROM public.pedidos      WHERE id = ANY(v_pedidos);

  -- Zerar saldos bancários
  UPDATE public.contas_bancarias SET saldo_atual = 0
   WHERE unidade_id IN (SELECT id FROM public.unidades WHERE empresa_id=v_empresa);
END $$;
