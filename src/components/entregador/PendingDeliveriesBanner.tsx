import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Package, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeliveryAlarm } from "@/hooks/useDeliveryAlarm";
import { useNotifications } from "@/hooks/useNotifications";

export function PendingDeliveriesBanner() {
  const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]);
  const { user } = useAuth();
  const location = useLocation();
  
  const { startAlarm, stopAlarm } = useDeliveryAlarm();
  const { permission, requestPermission, sendNotification } = useNotifications();
  const prevIdsRef = useRef<number[]>([]);
  const isFirstLoadRef = useRef(true);

  const fetchPending = useCallback(async () => {
    if (!user) return;

    const { data: entregador } = await supabase
      .from("entregadores")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entregador) return;

    const { data } = await supabase
      .from("pedidos")
      .select("id, created_at, endereco_entrega, clientes(nome)")
      .or(`and(entregador_id.eq.${entregador.id},status.eq.pendente),and(entregador_id.is.null,status.eq.pendente)`);

    if (data) {
      setPendingDeliveries(data);
    }
  }, [user]);

  // Poll every 15 seconds
  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000); // 15s for global is fine
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("pending-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  // Alarm and Push Notification Logic
  useEffect(() => {
    const currentIds = pendingDeliveries.map(d => d.id);
    const prevIds = prevIdsRef.current;
    const newIds = currentIds.filter(id => !prevIds.includes(id));
    
    // Check alarm config
    const alarmEnabled = localStorage.getItem("erp_entregador_som_ativo") !== "false";

    if (currentIds.length > 0 && alarmEnabled) {
      if (isFirstLoadRef.current || newIds.length > 0) {
        const hasUrgent = pendingDeliveries.some(e => {
          return (Date.now() - new Date(e.created_at).getTime()) >= 10 * 60 * 1000;
        });

        startAlarm(hasUrgent);
        
        if (newIds.length > 0 && permission === "granted") {
          const target = pendingDeliveries.find(e => e.id === newIds[0]);
          sendNotification({
            title: hasUrgent ? "🔴 Entrega URGENTE!" : "🚚 Nova Entrega!",
            body: `${target?.clientes?.nome || "Cliente"} - ${target?.endereco_entrega || ""}`,
            tag: `new-delivery-${newIds[0]}`,
          });
        }
      }
    } else if (currentIds.length === 0) {
      stopAlarm();
    }

    isFirstLoadRef.current = false;
    prevIdsRef.current = currentIds;
  }, [pendingDeliveries, startAlarm, stopAlarm, permission, sendNotification]);

  if (pendingDeliveries.length === 0) return null;
  // Se já estiver na tela de entregas, não mostramos o banner duplicado
  if (location.pathname.includes("/entregador/entregas")) return null;

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
        {pendingDeliveries.length === 1
          ? "1 entrega pendente aguardando!"
          : `${pendingDeliveries.length} entregas pendentes aguardando!`}
      </span>
      <Package className="h-5 w-5 ml-auto shrink-0" />
    </Link>
  );
}
