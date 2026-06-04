import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export interface PedidoPendente {
  id: string;
  numero_sequencial: number | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco_completo: string;
  bairro: string | null;
  valor_total: number;
  canal_venda: string | null;
  observacoes: string | null;
  forma_pagamento: string | null;
  created_at: string;
  itens_resumo: string;
}

const SNOOZE_KEY = "pedidos_pendentes_snooze";

function getSnoozeMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setSnoozeMap(map: Record<string, number>) {
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
}

export function usePedidosPendentesAlert() {
  const { unidadeAtual } = useUnidade();
  const [pendentes, setPendentes] = useState<PedidoPendente[]>([]);
  const fetchingRef = useRef(false);

  const fetchPendentes = useCallback(async () => {
    if (!unidadeAtual?.id || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, numero_sequencial, valor_total, canal_venda, observacoes,
          forma_pagamento, created_at, endereco_entrega, numero_entrega,
          bairro_entrega,
          cliente:cliente_id(nome, telefone),
          itens:pedido_itens(quantidade, produtos:produto_id(nome))
        `)
        .eq("unidade_id", unidadeAtual.id)
        .eq("status", "pendente")
        .is("entregador_id", null)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) {
        console.error("[PedidosPendentesAlert] erro:", error);
        return;
      }

      const snooze = getSnoozeMap();
      const now = Date.now();
      const cleanedSnooze: Record<string, number> = {};
      Object.entries(snooze).forEach(([k, v]) => {
        if (v > now) cleanedSnooze[k] = v;
      });
      setSnoozeMap(cleanedSnooze);

      const mapped: PedidoPendente[] = (data || [])
        .filter((p: any) => !cleanedSnooze[p.id] || cleanedSnooze[p.id] < now)
        .map((p: any) => {
          const enderecoParts = [
            p.endereco_entrega,
            p.numero_entrega ? `, ${p.numero_entrega}` : "",
          ].filter(Boolean);
          const itensResumo = (p.itens || [])
            .map((i: any) => `${i.quantidade}x ${i.produtos?.nome || "?"}`)
            .join(", ");
          return {
            id: p.id,
            numero_sequencial: p.numero_sequencial,
            cliente_nome: p.cliente?.nome || "Cliente",
            cliente_telefone: p.cliente?.telefone || null,
            endereco_completo: enderecoParts.join("") || "Endereço não informado",
            bairro: p.bairro_entrega,
            valor_total: Number(p.valor_total || 0),
            canal_venda: p.canal_venda,
            observacoes: p.observacoes,
            forma_pagamento: p.forma_pagamento,
            created_at: p.created_at,
            itens_resumo: itensResumo || "Sem itens",
          };
        });

      setPendentes(mapped);
    } finally {
      fetchingRef.current = false;
    }
  }, [unidadeAtual?.id]);

  useEffect(() => {
    fetchPendentes();
    const interval = setInterval(fetchPendentes, 10000);
    return () => clearInterval(interval);
  }, [fetchPendentes]);

  useEffect(() => {
    const syncVisualizados = (event: StorageEvent) => {
      if (event.key === SNOOZE_KEY) void fetchPendentes();
    };
    window.addEventListener("storage", syncVisualizados);
    return () => window.removeEventListener("storage", syncVisualizados);
  }, [fetchPendentes]);

  // Realtime
  useEffect(() => {
    if (!unidadeAtual?.id) return;
    const channel = supabase
      .channel(`pedidos-pendentes-${unidadeAtual.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        () => fetchPendentes()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeAtual?.id, fetchPendentes]);

  const snoozePedido = useCallback((pedidoId: string, minutos = 1) => {
    const map = getSnoozeMap();
    map[pedidoId] = Date.now() + minutos * 60 * 1000;
    setSnoozeMap(map);
    setPendentes((prev) => prev.filter((p) => p.id !== pedidoId));
  }, []);

  return { pendentes, snoozePedido, refetch: fetchPendentes };
}
