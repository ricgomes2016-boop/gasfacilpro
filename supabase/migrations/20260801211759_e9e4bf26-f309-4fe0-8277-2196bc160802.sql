CREATE OR REPLACE FUNCTION public.excluir_pedido_completo(_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contas_receber uuid[];
  v_devolucoes uuid[];
  v_mov record;
  v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pedidos WHERE id = _pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT has_role(auth.uid(), 'super_admin'::app_role)
     AND v_unidade IS NOT NULL
     AND NOT unidade_belongs_to_user_empresa(v_unidade) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_contas_receber
  FROM public.contas_receber WHERE pedido_id = _pedido_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_devolucoes
  FROM public.devolucoes WHERE pedido_id = _pedido_id;

  FOR v_mov IN
    SELECT conta_bancaria_id, COALESCE(SUM(valor), 0) AS valor_total
    FROM public.movimentacoes_bancarias
    WHERE referencia_id = _pedido_id AND referencia_tipo = 'pedido' AND conta_bancaria_id IS NOT NULL
    GROUP BY conta_bancaria_id
  LOOP
    UPDATE public.contas_bancarias
       SET saldo_atual = COALESCE(saldo_atual, 0) - v_mov.valor_total, updated_at = now()
     WHERE id = v_mov.conta_bancaria_id;
  END LOOP;

  UPDATE public.cliente_creditos SET pedido_id = NULL WHERE pedido_id = _pedido_id;
  UPDATE public.cliente_indicacoes SET primeiro_pedido_id = NULL WHERE primeiro_pedido_id = _pedido_id;
  UPDATE public.chat_mensagens SET pedido_id = NULL WHERE pedido_id = _pedido_id;
  UPDATE public.chamadas_recebidas SET pedido_gerado_id = NULL WHERE pedido_gerado_id = _pedido_id;
  UPDATE public.vendas_antecipadas SET pedido_utilizacao_id = NULL WHERE pedido_utilizacao_id = _pedido_id;
  UPDATE public.vale_gas SET venda_id = NULL WHERE venda_id = _pedido_id;
  UPDATE public.vendas_antecipadas_vales SET pedido_id = NULL WHERE pedido_id = _pedido_id;

  DELETE FROM public.boletos_emitidos WHERE conta_receber_id = ANY(v_contas_receber);
  DELETE FROM public.pagamentos_cartao WHERE conta_receber_id = ANY(v_contas_receber) OR pedido_id = _pedido_id;
  DELETE FROM public.devolucao_itens WHERE devolucao_id = ANY(v_devolucoes);

  DELETE FROM public.notificacoes_status_pedido WHERE pedido_id = _pedido_id;
  DELETE FROM public.avaliacoes_entrega WHERE pedido_id = _pedido_id;
  DELETE FROM public.comprovantes_entrega WHERE pedido_id = _pedido_id;
  DELETE FROM public.rastreio_lote WHERE pedido_id = _pedido_id;
  DELETE FROM public.cheques WHERE pedido_id = _pedido_id;
  DELETE FROM public.devolucoes WHERE pedido_id = _pedido_id;
  DELETE FROM public.conferencia_cartao WHERE pedido_id = _pedido_id;
  DELETE FROM public.movimentacoes_caixa WHERE pedido_id = _pedido_id;
  DELETE FROM public.movimentacoes_bancarias WHERE referencia_id = _pedido_id AND referencia_tipo = 'pedido';
  DELETE FROM public.extrato_bancario WHERE pedido_id = _pedido_id;
  DELETE FROM public.contas_receber WHERE pedido_id = _pedido_id;
  DELETE FROM public.pedido_itens WHERE pedido_id = _pedido_id;
  DELETE FROM public.pedidos WHERE id = _pedido_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.excluir_pedido_completo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_pedido_completo(uuid) TO authenticated;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT p.id INTO v_id
  FROM public.pedidos p
  JOIN public.unidades u ON u.id = p.unidade_id
  JOIN public.empresas e ON e.id = u.empresa_id
  WHERE p.numero_sequencial = 527 AND e.nome ILIKE '%forte%'
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    PERFORM public.excluir_pedido_completo(v_id);
  END IF;
END $$;