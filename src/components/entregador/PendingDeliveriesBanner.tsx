import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Package, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PendingDeliveriesBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  const fetchPending = useCallback(async () => {
    if (!user) return;

    const { data: entregador } = await supabase
      .from("entregadores")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entregador) return;

    const { count } = await supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .or(`and(entregador_id.eq.${entregador.id},status.eq.pendente),and(entregador_id.is.null,status.eq.pendente)`);

    setPendingCount(count ?? 0);
  }, [user]);

  // Poll every 15 seconds
  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`pending-banner-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  if (pendingCount === 0) return null;

  return (
    <Link
      to="/entregador/entregas"
      className={cn(
        "flex items-center gap-2 px-4 py-3 text-sm font-medium animate-pulse",
        "bg-destructive text-destructive-foreground"
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span>
        {pendingCount === 1
          ? "1 entrega pendente aguardando!"
          : `${pendingCount} entregas pendentes aguardando!`}
      </span>
      <Package className="h-5 w-5 ml-auto shrink-0" />
    </Link>
  );
}
