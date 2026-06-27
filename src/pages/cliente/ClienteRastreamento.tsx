import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import { DeliveryMap } from "@/components/cliente/DeliveryMap";
import { NotificationPermissionBanner, NotificationStatus } from "@/components/cliente/NotificationPermissionBanner";
import { useDeliveryNotifications } from "@/hooks/useDeliveryNotifications";
import { supabase } from "@/integrations/supabase/client";

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  const map = {
    connecting: { icon: Loader2, label: "Conectando…", cls: "bg-muted text-muted-foreground", spin: true },
    live: { icon: Wifi, label: "Ao vivo", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", spin: false },
    reconnecting: { icon: Loader2, label: "Reconectando…", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", spin: true },
    offline: { icon: WifiOff, label: "Sem conexão", cls: "bg-destructive/15 text-destructive", spin: false },
  }[status];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${map.cls}`}>
      <Icon className={`h-3 w-3 ${map.spin ? "animate-spin" : ""}`} />
      {map.label}
    </span>
  );
}

const statusSteps = [
  { key: "pendente", label: "Confirmado", desc: "Loja recebeu seu pedido", icon: CheckCircle2 },
  { key: "preparando", label: "Em preparo", desc: "Separando seus itens", icon: Package },
  { key: "em_rota", label: "A caminho", desc: "Entregador a caminho", icon: Truck },
  { key: "entregue", label: "Entregue", desc: "Pedido finalizado", icon: MapPin },
];

const statusOrder: Record<string, number> = {
  pendente: 0,
  preparando: 1,
  em_rota: 2,
  entregue: 3,
  cancelado: -1,
};

interface PedidoData {
  id: string;
  numero_sequencial: number | null;
  status: string;
  endereco_entrega: string | null;
  entregador_id: string | null;
  created_at: string;
  pedido_itens: { quantidade: number; produtos: { nome: string } | null }[];
}

interface EntregadorData {
  nome: string;
  telefone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function ClienteRastreamento() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { notifyStatusChange, requestPermission } = useDeliveryNotifications();
  const previousStatusRef = useRef<string | null>(null);
  
  const [pedido, setPedido] = useState<PedidoData | null>(null);
  const [entregador, setEntregador] = useState<EntregadorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pedidoRtStatus, setPedidoRtStatus] = useState<RealtimeStatus>("connecting");
  const [entregadorRtStatus, setEntregadorRtStatus] = useState<RealtimeStatus>("connecting");

  const fetchEntregador = useCallback(async (entregadorId: string) => {
    const { data } = await supabase
      .from("entregadores")
      .select("nome, telefone, latitude, longitude")
      .eq("id", entregadorId)
      .maybeSingle();
    if (data) setEntregador(data);
  }, []);

  const fetchPedido = useCallback(async () => {
    if (!orderId) return;
    const { data: pedidoData } = await supabase
      .from("pedidos")
      .select(`
        id, numero_sequencial, status, endereco_entrega, entregador_id, created_at,
        pedido_itens (quantidade, produtos:produto_id (nome))
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (pedidoData) {
      const typed = pedidoData as unknown as PedidoData;
      setPedido(prev => {
        if (prev && previousStatusRef.current && previousStatusRef.current !== typed.status) {
          notifyStatusChange(typed.status, typed.id);
        }
        previousStatusRef.current = typed.status;
        return typed;
      });
      if (previousStatusRef.current === null) previousStatusRef.current = typed.status;
      if (typed.entregador_id) fetchEntregador(typed.entregador_id);
    }
  }, [orderId, fetchEntregador, notifyStatusChange]);

  // Initial fetch
  useEffect(() => {
    (async () => {
      await fetchPedido();
      setIsLoading(false);
    })();
  }, [fetchPedido]);

  // Realtime subscription for pedido status changes
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`pedido-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${orderId}` },
        (payload) => {
          const newStatus = payload.new.status;
          setPedido(prev => prev ? { ...prev, status: newStatus, entregador_id: payload.new.entregador_id } : prev);

          if (previousStatusRef.current && previousStatusRef.current !== newStatus) {
            notifyStatusChange(newStatus, orderId);
          }
          previousStatusRef.current = newStatus;

          if (payload.new.entregador_id && payload.new.entregador_id !== payload.old?.entregador_id) {
            fetchEntregador(payload.new.entregador_id);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setPedidoRtStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setPedidoRtStatus("reconnecting");
          fetchPedido(); // refresca via REST enquanto reconecta
        } else if (status === "CLOSED") setPedidoRtStatus("offline");
      });

    return () => { supabase.removeChannel(channel); };
  }, [orderId, notifyStatusChange, fetchEntregador, fetchPedido]);

  // Realtime entregador position updates
  useEffect(() => {
    if (!pedido?.entregador_id) return;
    const entregadorId = pedido.entregador_id;

    const channel = supabase
      .channel(`entregador-pos-${entregadorId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "entregadores", filter: `id=eq.${entregadorId}` },
        (payload) => {
          setEntregador(prev => prev ? {
            ...prev,
            latitude: payload.new.latitude,
            longitude: payload.new.longitude
          } : prev);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setEntregadorRtStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setEntregadorRtStatus("reconnecting");
          fetchEntregador(entregadorId);
        } else if (status === "CLOSED") setEntregadorRtStatus("offline");
      });

    return () => { supabase.removeChannel(channel); };
  }, [pedido?.entregador_id, fetchEntregador]);

  // Fallback polling: ativa quando o realtime não está "live" (rede instável)
  useEffect(() => {
    if (pedidoRtStatus === "live") return;
    const id = setInterval(() => { fetchPedido(); }, 15000);
    return () => clearInterval(id);
  }, [pedidoRtStatus, fetchPedido]);

  // Reconnect ao voltar para a aba / recuperar conexão
  useEffect(() => {
    const onFocus = () => { fetchPedido(); };
    const onOnline = () => { fetchPedido(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchPedido]);

  useEffect(() => { requestPermission(); }, [requestPermission]);

  useEffect(() => {
    if (pedido && previousStatusRef.current === null) {
      previousStatusRef.current = pedido.status;
    }
  }, [pedido]);

  const currentStepIndex = statusSteps.findIndex(step => step.key === pedido?.status);

  if (isLoading) {
    return (
      <ClienteLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </ClienteLayout>
    );
  }

  if (!pedido) {
    return (
      <ClienteLayout>
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Pedido não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/cliente/historico")}>
            Ver meus pedidos
          </Button>
        </div>
      </ClienteLayout>
    );
  }

  const hasEntregadorPosition = entregador?.latitude && entregador?.longitude;

  return (
    <ClienteLayout>
      <div className="space-y-4">
        <NotificationPermissionBanner />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Rastrear Pedido</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  Pedido #{pedido.numero_sequencial ?? pedido.id.slice(-6).toUpperCase()}
                </p>
                <RealtimeBadge
                  status={
                    pedidoRtStatus === "live" && (!pedido.entregador_id || entregadorRtStatus === "live")
                      ? "live"
                      : pedidoRtStatus === "offline" || entregadorRtStatus === "offline"
                      ? "offline"
                      : pedidoRtStatus === "reconnecting" || entregadorRtStatus === "reconnecting"
                      ? "reconnecting"
                      : "connecting"
                  }
                />
              </div>
            </div>
          </div>
          <NotificationStatus />
        </div>

        {/* Map */}
        {hasEntregadorPosition && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[300px]">
                <DeliveryMap 
                  deliveryPosition={{ lat: entregador!.latitude!, lng: entregador!.longitude! }}
                  destinationPosition={{ lat: entregador!.latitude! + 0.005, lng: entregador!.longitude! + 0.005 }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status hero */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 animate-fade-in">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary-foreground/10 rounded-full" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-primary-foreground/20 rounded-2xl flex items-center justify-center shrink-0">
                  {pedido.status === "em_rota" ? (
                    <Truck className="h-6 w-6 animate-pulse" />
                  ) : pedido.status === "entregue" ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Clock className="h-6 w-6 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Status do pedido</p>
                  <p className="text-xl font-bold leading-tight">
                    {pedido.status === "em_rota" ? "A caminho 🚀" : pedido.status === "entregue" ? "Entregue ✅" : "Confirmado"}
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    {pedido.status === "em_rota" ? "Chegando em instantes" : pedido.status === "entregue" ? "Obrigado pela preferência!" : "Aguardando preparação"}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-primary shrink-0">
                {pedido.status === "entregue" ? "Concluído" : "Em andamento"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Connected Stepper */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              {/* Connecting line (background) */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
              {/* Connecting line (filled) */}
              <div
                className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500"
                style={{
                  width: `calc((100% - 2.5rem) * ${Math.max(0, currentStepIndex) / (statusSteps.length - 1)})`,
                }}
              />
              <div className="relative flex justify-between">
                {statusSteps.map((step, index) => {
                  const isActive = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-1.5 w-1/4">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2
                        ${isCurrent ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/40 scale-110" : ""}
                        ${isActive && !isCurrent ? "bg-primary text-primary-foreground border-primary" : ""}
                        ${!isActive ? "bg-background text-muted-foreground border-muted" : ""}
                      `}>
                        <step.icon className="h-4 w-4" />
                      </div>
                      <span className={`text-[11px] text-center leading-tight ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Person */}
        {entregador && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Seu Entregador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                    🧑‍💼
                  </div>
                  <div>
                    <p className="font-medium">{entregador.nome}</p>
                    <p className="text-sm text-muted-foreground">Entregador</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {entregador.telefone && (
                    <>
                      <Button size="icon" variant="outline" className="rounded-full" asChild>
                        <a href={`tel:${entregador.telefone}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="outline" className="rounded-full" asChild>
                        <a href={`https://wa.me/55${entregador.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pedido.pedido_itens.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{item.quantidade}x {item.produtos?.nome || "Produto"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardContent className="p-4">
            <Button variant="outline" className="w-full">
              Precisa de ajuda com seu pedido?
            </Button>
          </CardContent>
        </Card>
      </div>
    </ClienteLayout>
  );
}
