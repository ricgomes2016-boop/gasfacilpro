import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getBrasiliaDateString } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

export interface AvisoEntregador {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: "normal" | "importante" | "urgente";
  fixado: boolean;
  exibir_de: string;
  exibir_ate: string | null;
  created_at?: string;
  lido?: boolean;
}

export function useAvisosEntregador(enableBrowserNotifications = true) {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [avisos, setAvisos] = useState<AvisoEntregador[]>([]);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const knownAvisos = useRef<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: entregador } = await supabase
      .from("entregadores")
      .select("id, unidade_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entregador) {
      setEntregadorId(null);
      setAvisos([]);
      setLoading(false);
      return;
    }

    setEntregadorId(entregador.id);
    const hoje = getBrasiliaDateString();
    let query = (supabase
      .from("rh_avisos_entregador" as any)
      .select("id, titulo, mensagem, prioridade, fixado, exibir_de, exibir_ate, created_at")
      .eq("ativo", true)
      .lte("exibir_de", hoje)
      .or(`exibir_ate.is.null,exibir_ate.gte.${hoje}`)
      .order("fixado", { ascending: false })
      .order("created_at", { ascending: false }) as any);

    if ((entregador as any).unidade_id) {
      query = query.or(`unidade_id.is.null,unidade_id.eq.${(entregador as any).unidade_id}`);
    } else {
      query = query.is("unidade_id", null);
    }

    const { data } = await query.limit(20);
    const rows = (data || []) as AvisoEntregador[];
    const ids = rows.map((aviso) => aviso.id);
    const { data: leituras } = ids.length
      ? await (supabase
          .from("rh_avisos_entregador_leituras" as any)
          .select("aviso_id")
          .eq("entregador_id", entregador.id)
          .in("aviso_id", ids) as any)
      : { data: [] };

    const lidos = new Set((leituras || []).map((l: any) => l.aviso_id));
    const avisosComLeitura = rows.map((aviso) => ({ ...aviso, lido: lidos.has(aviso.id) }));
    const novosNaoLidos = avisosComLeitura.filter((aviso) => !aviso.lido && !knownAvisos.current.has(aviso.id));

    if (enableBrowserNotifications && initialLoadDone.current && novosNaoLidos.length > 0) {
      const aviso = novosNaoLidos[0];
      sendNotification({
        title: novosNaoLidos.length === 1 ? "📣 Novo aviso do RH" : `📣 ${novosNaoLidos.length} novos avisos do RH`,
        body: aviso.titulo,
        tag: "rh-avisos-entregador",
      });
    }

    knownAvisos.current = new Set(ids);
    initialLoadDone.current = true;
    setAvisos(avisosComLeitura);
    setLoading(false);
  }, [enableBrowserNotifications, sendNotification, user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`rh-avisos-entregador-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_avisos_entregador" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_avisos_entregador_leituras" }, carregar)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregar, user]);

  const marcarComoLidos = useCallback(
    async (avisoIds: string[]) => {
      if (!entregadorId || avisoIds.length === 0) return;
      const naoLidos = avisos.filter((aviso) => avisoIds.includes(aviso.id) && !aviso.lido);
      if (naoLidos.length === 0) return;

      await (supabase.from("rh_avisos_entregador_leituras" as any).upsert(
        naoLidos.map((aviso) => ({ aviso_id: aviso.id, entregador_id: entregadorId })),
        { onConflict: "aviso_id,entregador_id" }
      ) as any);

      setAvisos((prev) => prev.map((aviso) => (avisoIds.includes(aviso.id) ? { ...aviso, lido: true } : aviso)));
    },
    [avisos, entregadorId]
  );

  const naoLidos = useMemo(() => avisos.filter((aviso) => !aviso.lido).length, [avisos]);

  return { avisos, naoLidos, loading, marcarComoLidos, refetch: carregar };
}