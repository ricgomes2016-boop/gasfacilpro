import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PedidoFormatado, PedidoStatus } from "@/types/pedido";
import { useUnidade } from "@/contexts/UnidadeContext";
import { reverterEstoqueVenda } from "@/services/estoqueService";
import { toast } from "sonner";
import { requestNotificationPermission } from "@/services/notificationService";

export function usePedidos(filtros?: { dataInicio?: string; dataFim?: string }) {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();

  type SupabaseMutationResult = { error: { message: string } | null };

  const ensureNoError = (result: SupabaseMutationResult, label: string) => {
    if (result.error) {
      throw new Error(`${label}: ${result.error.message}`);
    }
  };

  const limparVinculosPedido = async (pedidoId: string) => {
    const db = supabase;

    const { data: movimentacoesBancarias } = await db
      .from("movimentacoes_bancarias")
      .select("conta_bancaria_id, valor")
      .eq("referencia_id", pedidoId)
      .eq("referencia_tipo", "pedido");

    const ajustePorConta = (movimentacoesBancarias || []).reduce<Record<string, number>>((acc, mov: any) => {
      if (!mov.conta_bancaria_id) return acc;
      acc[mov.conta_bancaria_id] = (acc[mov.conta_bancaria_id] || 0) + Number(mov.valor || 0);
      return acc;
    }, {});

    for (const [contaId, valorMovimentado] of Object.entries(ajustePorConta)) {
      const { data: conta, error: contaError } = await db
        .from("contas_bancarias")
        .select("saldo_atual")
        .eq("id", contaId)
        .maybeSingle();
      if (contaError) throw new Error(`Erro ao buscar saldo bancário: ${contaError.message}`);

      const { error: saldoError } = await db
        .from("contas_bancarias")
        .update({ saldo_atual: Number(conta?.saldo_atual || 0) - valorMovimentado })
        .eq("id", contaId);
      if (saldoError) throw new Error(`Erro ao reverter saldo bancário: ${saldoError.message}`);
    }

    await Promise.all([
      db.from("cliente_creditos").update({ pedido_id: null }).eq("pedido_id", pedidoId),
      db.from("cliente_indicacoes").update({ primeiro_pedido_id: null }).eq("primeiro_pedido_id", pedidoId),
      db.from("chat_mensagens").update({ pedido_id: null }).eq("pedido_id", pedidoId),
      db.from("chamadas_recebidas").update({ pedido_gerado_id: null }).eq("pedido_gerado_id", pedidoId),
      db.from("vendas_antecipadas").update({ pedido_utilizacao_id: null }).eq("pedido_utilizacao_id", pedidoId),
      db.from("vale_gas").update({ venda_id: null }).eq("venda_id", pedidoId),
      db.from("vendas_antecipadas_vales").update({ pedido_id: null }).eq("pedido_id", pedidoId),
    ]).then((results) => {
      results.forEach((result, index) => ensureNoError(result, `Erro ao desvincular referência ${index + 1}`));
    });

    const { data: contasReceber } = await db
      .from("contas_receber")
      .select("id")
      .eq("pedido_id", pedidoId);
    const contasReceberIds = (contasReceber || []).map((conta: { id: string }) => conta.id);

    if (contasReceberIds.length > 0) {
      await Promise.all([
        db.from("boletos_emitidos").delete().in("conta_receber_id", contasReceberIds),
        db.from("pagamentos_cartao").delete().in("conta_receber_id", contasReceberIds),
      ]).then((results) => {
        results.forEach((result, index) => ensureNoError(result, `Erro ao excluir vínculo financeiro ${index + 1}`));
      });
    }

    const { data: devolucoes } = await db
      .from("devolucoes")
      .select("id")
      .eq("pedido_id", pedidoId);
    const devolucaoIds = (devolucoes || []).map((devolucao: { id: string }) => devolucao.id);

    if (devolucaoIds.length > 0) {
      ensureNoError(
        await db.from("devolucao_itens").delete().in("devolucao_id", devolucaoIds),
        "Erro ao excluir itens de devolução"
      );
    }

    await Promise.all([
      db.from("notificacoes_status_pedido").delete().eq("pedido_id", pedidoId),
      db.from("avaliacoes_entrega").delete().eq("pedido_id", pedidoId),
      db.from("comprovantes_entrega").delete().eq("pedido_id", pedidoId),
      db.from("rastreio_lote").delete().eq("pedido_id", pedidoId),
      db.from("cheques").delete().eq("pedido_id", pedidoId),
      db.from("devolucoes").delete().eq("pedido_id", pedidoId),
      db.from("conferencia_cartao").delete().eq("pedido_id", pedidoId),
      db.from("pagamentos_cartao").delete().eq("pedido_id", pedidoId),
      db.from("movimentacoes_caixa").delete().eq("pedido_id", pedidoId),
      db.from("movimentacoes_bancarias").delete().eq("referencia_id", pedidoId).eq("referencia_tipo", "pedido"),
      db.from("extrato_bancario").delete().eq("pedido_id", pedidoId),
      db.from("contas_receber").delete().eq("pedido_id", pedidoId),
    ]).then((results) => {
      results.forEach((result, index) => ensureNoError(result, `Erro ao excluir dependência ${index + 1}`));
    });
  };

  const formatarDataPedido = (value: string) => {
    const data = new Date(value);
    return format(data, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const { data: pedidos = [], isLoading, error } = useQuery({
    queryKey: ["pedidos", unidadeAtual?.id, filtros?.dataInicio, filtros?.dataFim],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select(`
          *,
          clientes (id, nome, endereco, bairro, cidade),
          entregadores (id, nome)
        `)
        .order("data_entrega", { ascending: false })
        .order("created_at", { ascending: false });

      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }

      if (filtros?.dataInicio) {
        query = query.gte("data_entrega", filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        query = query.lte("data_entrega", filtros.dataFim);
      }

      const { data: pedidosData, error: pedidosError } = await query;
      if (pedidosError) throw pedidosError;

      const pedidosFormatados: PedidoFormatado[] = await Promise.all(
        (pedidosData || []).map(async (pedido) => {
          const { data: itensData } = await supabase
            .from("pedido_itens")
            .select(`*, produtos (id, nome)`)
            .eq("pedido_id", pedido.id);

          const itens = itensData || [];
          const produtosStr = itens
            .map((item) => `${item.quantidade}x ${item.produtos?.nome || "Produto"}`)
            .join(", ") || "Sem itens";

          const cliente = pedido.clientes;
          const endereco = pedido.endereco_entrega || 
            (cliente ? [cliente.endereco, cliente.bairro, cliente.cidade].filter(Boolean).join(", ") : "Endereço não informado");

          // Extract client name from observacoes for WhatsApp orders without cliente_id
          let clienteNome = cliente?.nome || "Cliente não identificado";
          if (!cliente && pedido.observacoes) {
            const match = pedido.observacoes.match(/Pedido via WhatsApp\s*-\s*(.+?)\s*\(/);
            if (match) clienteNome = match[1].trim();
          }

          const dataOperacional = (pedido as any).data_entrega
            ? new Date(`${(pedido as any).data_entrega}T12:00:00-03:00`)
            : new Date(pedido.created_at);

          return {
            id: pedido.id,
            numero_sequencial: (pedido as any).numero_sequencial ?? null,
            cliente: clienteNome,
            cliente_id: pedido.cliente_id,
            endereco,
            produtos: produtosStr,
            itens: itens.map((item) => ({
              id: item.id,
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              preco_unitario: Number(item.preco_unitario),
              produto: item.produtos ? { id: item.produtos.id, nome: item.produtos.nome } : undefined,
            })),
            valor: Number(pedido.valor_total) || 0,
            status: (pedido.status as PedidoStatus) || "pendente",
            data: format(dataOperacional, "dd/MM/yyyy", { locale: ptBR }),
            entregador: pedido.entregadores?.nome,
            entregador_id: pedido.entregador_id,
            observacoes: pedido.observacoes || undefined,
            forma_pagamento: pedido.forma_pagamento || undefined,
            canal_venda: pedido.canal_venda || undefined,
            origem_pedido: ((pedido as any).origem_pedido as any) || undefined,
            agendado: (pedido as any).agendado || false,
            data_agendamento: (pedido as any).data_agendamento || null,
            data_entrega: (pedido as any).data_entrega || null,
          };
        })
      );

      return pedidosFormatados;
    },
  });

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // #8 - Realtime: auto-refresh on pedidos changes + toast notifications
  const knownPedidosRef = useRef<Map<string, string>>(new Map());
  const isFirstLoadRef = useRef(true);

  // Track known pedidos for toast diff
  useEffect(() => {
    if (pedidos.length > 0 && isFirstLoadRef.current) {
      pedidos.forEach(p => knownPedidosRef.current.set(p.id, p.status));
      isFirstLoadRef.current = false;
    }
  }, [pedidos]);

  useEffect(() => {
    if (!unidadeAtual?.id) return;

    const channel = supabase
      .channel(`pedidos-realtime-${unidadeAtual.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos", filter: `unidade_id=eq.${unidadeAtual.id}` },
        () => {
          // Notificação visual/sonora centralizada em useNovoPedidoNotifier.
          // Aqui apenas atualizamos a lista.
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `unidade_id=eq.${unidadeAtual.id}` },
        (payload) => {
          const p = payload.new as any;
          const prevStatus = knownPedidosRef.current.get(p.id);
          const newStatus = p?.status;
          if (prevStatus && newStatus && prevStatus !== newStatus) {
            const icons: Record<string, string> = { pendente: "🕐", em_rota: "🚚", entregue: "✅", cancelado: "❌", finalizado: "✅", aguardando_pagamento_cartao: "💳", pagamento_em_processamento: "⏳", pago_cartao: "✅", pagamento_negado: "❌" };
            const labels: Record<string, string> = { pendente: "Pendente", em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado", finalizado: "Finalizado", aguardando_pagamento_cartao: "Aguard. Cartão", pagamento_em_processamento: "Processando", pago_cartao: "Pago (Cartão)", pagamento_negado: "Pgto Negado" };
            const pedidoRef = p?.numero_sequencial != null ? String(p.numero_sequencial) : p.id?.substring(0, 8).toUpperCase();
            toast(`${icons[newStatus] || "📦"} Status Atualizado`, {
              description: `Pedido #${pedidoRef}: ${labels[newStatus] || newStatus}`,
              duration: 4000,
            });
          }
          if (p?.status) knownPedidosRef.current.set(p.id, p.status);
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pedidos", filter: `unidade_id=eq.${unidadeAtual.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, unidadeAtual?.id]);

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, novoStatus }: { pedidoId: string; novoStatus: PedidoStatus }) => {
      // Se cancelando, reverter estoque
      if (novoStatus === "cancelado") {
        const { data: itensData } = await supabase
          .from("pedido_itens")
          .select("produto_id, quantidade")
          .eq("pedido_id", pedidoId);

        const { data: pedidoData } = await supabase
          .from("pedidos")
          .select("unidade_id, status")
          .eq("id", pedidoId)
          .single();

        if (pedidoData?.status !== "cancelado" && itensData && itensData.length > 0) {
          await reverterEstoqueVenda(
            itensData.filter(i => i.produto_id).map(i => ({ produto_id: i.produto_id!, quantidade: i.quantidade })),
            pedidoData?.unidade_id
          );
        }
      }

      const { error } = await supabase
        .from("pedidos")
        .update({ status: novoStatus })
        .eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  const atribuirEntregadorMutation = useMutation({
    mutationFn: async ({ pedidoId, entregadorId }: { pedidoId: string; entregadorId: string }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ entregador_id: entregadorId })
        .eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  const excluirPedidoMutation = useMutation({
    mutationFn: async ({ pedidoId }: { pedidoId: string }) => {
      // Buscar itens do pedido para reverter estoque
      const { data: itensData } = await supabase
        .from("pedido_itens")
        .select("produto_id, quantidade")
        .eq("pedido_id", pedidoId);

      // Buscar unidade do pedido
      const { data: pedidoData } = await supabase
        .from("pedidos")
        .select("unidade_id")
        .eq("id", pedidoId)
        .single();

      // Reverter estoque
      if (itensData && itensData.length > 0) {
        await reverterEstoqueVenda(
          itensData.filter(i => i.produto_id).map(i => ({ produto_id: i.produto_id!, quantidade: i.quantidade })),
          pedidoData?.unidade_id
        );
      }

      const { error: rpcError } = await (supabase as any).rpc("excluir_pedido_completo", { _pedido_id: pedidoId });
      if (rpcError) {
        console.warn("RPC excluir_pedido_completo indisponível, usando fallback cliente:", rpcError.message);
        await limparVinculosPedido(pedidoId);

        const { error: itensError } = await supabase
          .from("pedido_itens")
          .delete()
          .eq("pedido_id", pedidoId);
        if (itensError) throw itensError;

        const { error } = await supabase
          .from("pedidos")
          .delete()
          .eq("id", pedidoId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  // Batch status update for #7
  const atualizarStatusLoteMutation = useMutation({
    mutationFn: async ({ pedidoIds, novoStatus }: { pedidoIds: string[]; novoStatus: PedidoStatus }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: novoStatus })
        .in("id", pedidoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  const atribuirEntregadorLoteMutation = useMutation({
    mutationFn: async ({ pedidoIds, entregadorId }: { pedidoIds: string[]; entregadorId: string }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ entregador_id: entregadorId })
        .in("id", pedidoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  // Marcar pedido como portaria (responsavel_acerto)
  const marcarPortariaMutation = useMutation({
    mutationFn: async ({ pedidoId }: { pedidoId: string }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: "entregue", responsavel_acerto: "portaria", entregador_id: null } as any)
        .eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  const marcarPortariaLoteMutation = useMutation({
    mutationFn: async ({ pedidoIds }: { pedidoIds: string[] }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: "entregue", responsavel_acerto: "portaria", entregador_id: null } as any)
        .in("id", pedidoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  // Ao atribuir entregador, limpar responsavel_acerto
  const atribuirEntregadorComAcertoMutation = useMutation({
    mutationFn: async ({ pedidoId, entregadorId }: { pedidoId: string; entregadorId: string }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ entregador_id: entregadorId, responsavel_acerto: null } as any)
        .eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  return {
    pedidos,
    isLoading,
    error,
    atualizarStatus: atualizarStatusMutation.mutate,
    atribuirEntregador: atribuirEntregadorComAcertoMutation.mutate,
    excluirPedido: excluirPedidoMutation.mutate,
    atualizarStatusLote: atualizarStatusLoteMutation.mutate,
    atribuirEntregadorLote: atribuirEntregadorLoteMutation.mutate,
    marcarPortaria: marcarPortariaMutation.mutate,
    marcarPortariaLote: marcarPortariaLoteMutation.mutate,
    isUpdating: atualizarStatusMutation.isPending || atribuirEntregadorMutation.isPending || atualizarStatusLoteMutation.isPending || atribuirEntregadorLoteMutation.isPending || marcarPortariaMutation.isPending || marcarPortariaLoteMutation.isPending,
    isDeleting: excluirPedidoMutation.isPending,
  };
}
