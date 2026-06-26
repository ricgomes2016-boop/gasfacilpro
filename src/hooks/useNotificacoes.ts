import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

function dedupeNotificacoes(items: Notificacao[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.tipo === "pedido" && item.link
      ? `${item.tipo}:${item.link}`
      : item.id;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useNotificacoes() {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const fetchNotificacoes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setNotificacoes(dedupeNotificacoes(data));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotificacoes();
  }, [fetchNotificacoes]);

  // Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notificacoes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotificacoes((prev) => dedupeNotificacoes([payload.new as Notificacao, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const marcarComoLida = useCallback(
    async (id: string) => {
      await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
      );
    },
    []
  );

  const marcarTodasComoLidas = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("user_id", user.id)
      .eq("lida", false);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }, [user]);

  const deletar = useCallback(async (id: string) => {
    await supabase.from("notificacoes").delete().eq("id", id);
    setNotificacoes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notificacoes,
    naoLidas,
    loading,
    marcarComoLida,
    marcarTodasComoLidas,
    deletar,
    refetch: fetchNotificacoes,
  };
}
