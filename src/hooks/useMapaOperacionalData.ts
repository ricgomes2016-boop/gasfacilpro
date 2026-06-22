import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PontoGPS {
  lat: number;
  lng: number;
  created_at: string;
  latitude: number;
  longitude: number;
}

export interface EntregadorOp {
  id: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  updated_at?: string;
  unidade_id?: string | null;
  pedidosAtivos?: number;
  localizacao?: { lat: number; lng: number } | null;
}

export interface PedidoOp {
  id: string;
  status: string;
  entregador_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_entrega?: string | null;
  valor_total?: number | null;
  created_at: string;
  unidade_id?: string | null;
  clientes?: any;
  pedido_itens?: any;
  localizacao?: { lat: number; lng: number } | null;
}

interface UseMapaOperacionalDataOptions {
  unidadeId?: string | null;
  empresaId?: string | null;
  refreshMs?: number;
  janelaHoras?: number;
}

export function useMapaOperacionalData({
  unidadeId,
  empresaId,
  refreshMs = 30000,
  janelaHoras = 4,
}: UseMapaOperacionalDataOptions) {
  const [entregadores, setEntregadores] = useState<EntregadorOp[]>([]);
  const [pedidos, setPedidos] = useState<PedidoOp[]>([]);
  const [pontosCache, setPontosCache] = useState<Record<string, PontoGPS[]>>({});
  const [rotasAtivasPorEntregador, setRotasAtivasPorEntregador] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      // Sem unidade selecionada → não traz nada (evita vazamento entre empresas/unidades)
      if (!unidadeId) {
        setEntregadores([]);
        setPedidos([]);
        setPontosCache({});
        setRotasAtivasPorEntregador({});
        setLoading(false);
        return;
      }

      const desde = new Date(Date.now() - janelaHoras * 60 * 60 * 1000).toISOString();

      // Entregadores — escopa por unidade e (defensivamente) por empresa
      let eq = supabase.from("entregadores").select("*").eq("ativo", true).eq("unidade_id", unidadeId);
      if (empresaId) eq = eq.eq("empresa_id", empresaId);
      const { data: entregs } = await eq;

      const ents: EntregadorOp[] = (entregs || []).map((e: any) => ({
        ...e,
        localizacao: e.latitude && e.longitude ? { lat: e.latitude, lng: e.longitude } : null,
      }));

      // Pedidos do dia ativos
      const hojeInicio = new Date(); hojeInicio.setHours(0, 0, 0, 0);
      let pq: any = supabase
        .from("pedidos")
        .select("*, clientes(nome, bairro, endereco, telefone, latitude, longitude), pedido_itens(quantidade, produtos(nome))")
        .gte("created_at", hojeInicio.toISOString())
        .in("status", ["pendente", "confirmado", "em_rota", "saiu_entrega", "em_preparo"])
        .eq("unidade_id", unidadeId);
      if (empresaId) pq = pq.eq("empresa_id", empresaId);
      const { data: peds } = await pq;

      const peds2: PedidoOp[] = (peds || []).map((p: any) => {
        const lat = p.latitude ?? p.clientes?.latitude;
        const lng = p.longitude ?? p.clientes?.longitude;
        return {
          ...p,
          localizacao: lat && lng ? { lat, lng } : null,
        };
      });

      // Carga por entregador
      const cargaPorEntregador: Record<string, number> = {};
      peds2.forEach((p) => {
        if (p.entregador_id && p.status !== "entregue" && p.status !== "cancelado") {
          cargaPorEntregador[p.entregador_id] = (cargaPorEntregador[p.entregador_id] || 0) + 1;
        }
      });
      ents.forEach((e) => { e.pedidosAtivos = cargaPorEntregador[e.id] || 0; });

      // Pontos GPS via rotas em andamento
      const entIds = ents.map((e) => e.id);
      const novoCache: Record<string, PontoGPS[]> = {};
      const rotasMap: Record<string, string> = {};

      if (entIds.length) {
        const { data: rotas } = await supabase
          .from("rotas")
          .select("id, entregador_id")
          .in("entregador_id", entIds)
          .eq("status", "em_andamento");

        const rotaIds = (rotas || []).map((r: any) => r.id);
        const rotaToEnt: Record<string, string> = {};
        (rotas || []).forEach((r: any) => {
          rotaToEnt[r.id] = r.entregador_id;
          rotasMap[r.entregador_id] = r.id;
        });

        if (rotaIds.length) {
          const { data: hist } = await supabase
            .from("rota_historico")
            .select("rota_id, latitude, longitude, timestamp")
            .in("rota_id", rotaIds)
            .gte("timestamp", desde)
            .order("timestamp", { ascending: true });

          (hist || []).forEach((h: any) => {
            const eid = rotaToEnt[h.rota_id];
            if (!eid) return;
            (novoCache[eid] ||= []).push({
              lat: h.latitude,
              lng: h.longitude,
              latitude: h.latitude,
              longitude: h.longitude,
              created_at: h.timestamp,
            });
          });
        }
      }

      setRotasAtivasPorEntregador(rotasMap);

      setEntregadores(ents);
      setPedidos(peds2);
      setPontosCache(novoCache);
      setLoading(false);
    } catch (err) {
      console.error("[useMapaOperacionalData] erro:", err);
      setLoading(false);
    }
  }, [unidadeId, janelaHoras]);

  // Refresh periódico
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, refreshMs);
    return () => clearInterval(id);
  }, [fetchAll, refreshMs]);

  // Realtime incremental
  useEffect(() => {
    if (!unidadeId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    const ch = supabase
      .channel(`mapa-op-${unidadeId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pedidos",
        filter: `unidade_id=eq.${unidadeId}`,
      }, () => fetchAll())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "entregadores",
        filter: `unidade_id=eq.${unidadeId}`,
      }, () => fetchAll())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "rota_historico",
      }, () => fetchAll())
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll, unidadeId]);

  return { entregadores, pedidos, pontosCache, rotasAtivasPorEntregador, loading, refresh: fetchAll };
}
