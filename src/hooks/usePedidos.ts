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
    const channel = supabase
      .channel("pedidos-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        () => {
          // Notificação visual/sonora centralizada em useNovoPedidoNotifier.
          // Aqui apenas atualizamos a lista.
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
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
        { event: "DELETE", schema: "public", table: "pedidos" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
