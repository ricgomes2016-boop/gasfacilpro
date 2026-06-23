import { useState, useEffect, useRef } from "react";
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
  CheckCircle2
} from "lucide-react";
import { DeliveryMap } from "@/components/cliente/DeliveryMap";
import { NotificationPermissionBanner, NotificationStatus } from "@/components/cliente/NotificationPermissionBanner";
import { useDeliveryNotifications } from "@/hooks/useDeliveryNotifications";
import { supabase } from "@/integrations/supabase/client";

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

  // Fetch pedido and entregador data
  useEffect(() => {
    const fetchData = async () => {
      if (!orderId) return;

      const { data: pedidoData } = await supabase
        .from("pedidos")
        .select(`
          id, status, endereco_entrega, entregador_id, created_at,
          pedido_itens (quantidade, produtos:produto_id (nome))
        `)
        .eq("id", orderId)
        .maybeSingle();

      if (pedidoData) {
        setPedido(pedidoData as unknown as PedidoData);
        // Inicializa imediatamente para evitar toast falso na 1ª carga
        if (previousStatusRef.current === null) {
          previousStatusRef.current = pedidoData.status;
        }

        if (pedidoData.entregador_id) {
          const { data: entregadorData } = await supabase
            .from("entregadores")
            .select("nome, telefone, latitude, longitude")
            .eq("id", pedidoData.entregador_id)
            .maybeSingle();
          
          if (entregadorData) setEntregador(entregadorData);
        }
      }
      setIsLoading(false);
    };

    fetchData();
  }, [orderId]);

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

          // Refresh entregador if assigned
          if (payload.new.entregador_id && payload.new.entregador_id !== payload.old?.entregador_id) {
            supabase
              .from("entregadores")
              .select("nome, telefone, latitude, longitude")
              .eq("id", payload.new.entregador_id)
              .maybeSingle()
              .then(({ data }) => { if (data) setEntregador(data); });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, notifyStatusChange]);

  // Realtime entregador position updates
  useEffect(() => {
    if (!pedido?.entregador_id) return;

    const channel = supabase
      .channel(`entregador-pos-${pedido.entregador_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "entregadores", filter: `id=eq.${pedido.entregador_id}` },
        (payload) => {
          setEntregador(prev => prev ? {
            ...prev,
            latitude: payload.new.latitude,
            longitude: payload.new.longitude
          } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pedido?.entregador_id]);

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
              <p className="text-sm text-muted-foreground">
                Pedido #{pedido.id.slice(-6).toUpperCase()}
              </p>
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

        {/* Status Info */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6" />
                <div>
                  <p className="text-sm opacity-90">Status do pedido</p>
                  <p className="text-xl font-bold capitalize">
                    {pedido.status === "em_rota" ? "A caminho" : pedido.status === "entregue" ? "Entregue" : "Pendente"}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-primary">
                {pedido.status === "entregue" ? "Concluído" : "Em andamento"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-4">
            <Progress value={statusProgress[pedido.status] || 0} className="mb-4" />
            <div className="flex justify-between">
              {statusSteps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1">
                    <div className={`
                      p-2 rounded-full transition-colors
                      ${isCurrent ? "bg-primary text-primary-foreground" : ""}
                      ${isActive && !isCurrent ? "bg-primary/20 text-primary" : ""}
                      ${!isActive ? "bg-muted text-muted-foreground" : ""}
                    `}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className={`text-xs text-center ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
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
