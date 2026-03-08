import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { startOfDay } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Package, Truck, CheckCircle, RefreshCw, BellRing, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { IniciarRotaModal } from "@/components/entregador/IniciarRotaModal";
import { EntregaCard, type EntregaDB } from "@/components/entregador/EntregaCard";
import { useDeliveryAlarm } from "@/hooks/useDeliveryAlarm";
import { useNotifications } from "@/hooks/useNotifications";
import { Capacitor } from "@capacitor/core";

export default function EntregadorEntregas() {
  const [entregas, setEntregas] = useState<EntregaDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tabAtiva, setTabAtiva] = useState("pendentes");
  const [modalIniciarRota, setModalIniciarRota] = useState(false);
  const [entregaParaIniciar, setEntregaParaIniciar] = useState<EntregaDB | null>(null);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { startAlarm, stopAlarm, isPlaying } = useDeliveryAlarm();
  const { permission, requestPermission, sendNotification } = useNotifications();
  const prevPendentesRef = useRef<string[]>([]);
  const isFirstLoadRef = useRef(true);

  const fetchEntregas = useCallback(async () => {
    if (!user) return;

    try {
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (entregador) setEntregadorId(entregador.id);

      let query = supabase
        .from("pedidos")
        .select(`
          id, created_at, valor_total, status, forma_pagamento, endereco_entrega, observacoes, cliente_id,
          clientes:cliente_id (nome, telefone, bairro, latitude, longitude),
          pedido_itens (id, quantidade, preco_unitario, produtos:produto_id (nome))
        `)
        .in("status", ["pendente", "em_rota", "entregue"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (entregador) {
        query = query.or(`entregador_id.eq.${entregador.id},and(entregador_id.is.null,status.eq.pendente)`);
      } else {
        query = query.eq("status", "pendente");
      }

      const { data, error } = await query;
      if (!error && data) setEntregas(data as unknown as EntregaDB[]);
    } catch (err) {
      console.error("Erro ao buscar entregas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    fetchEntregas();
    const interval = setInterval(() => fetchEntregas(), 5000);
    return () => clearInterval(interval);
  }, [fetchEntregas]);

  // Detect new pending deliveries and trigger alarm (urgent if 10+ min old)
  useEffect(() => {
    const currentPendentes = entregas.filter(e => e.status === "pendente");
    const currentIds = currentPendentes.map(e => e.id);
    const prevIds = prevPendentesRef.current;
    const newIds = currentIds.filter(id => !prevIds.includes(id));

    if (currentIds.length > 0 && alarmEnabled) {
      if (isFirstLoadRef.current || newIds.length > 0) {
        // Check if any pending delivery is older than 10 minutes
        const hasUrgent = currentPendentes.some(e => {
          const waitMs = Date.now() - new Date(e.created_at).getTime();
          return waitMs >= 10 * 60 * 1000;
        });

        startAlarm(hasUrgent);
        if (permission === "granted") {
          const targetEntrega = entregas.find(e => e.id === (newIds[0] || currentIds[0]));
          sendNotification({
            title: hasUrgent ? "🔴 Entrega URGENTE!" : "🚚 Nova Entrega!",
            body: `${targetEntrega?.clientes?.nome || "Cliente"} - ${targetEntrega?.endereco_entrega || ""}`,
            tag: `new-delivery-${newIds[0] || currentIds[0]}`,
          });
        }
      }
    }

    isFirstLoadRef.current = false;
    prevPendentesRef.current = currentIds;
  }, [entregas, alarmEnabled, startAlarm, permission, sendNotification]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("pedidos-entregador")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchEntregas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntregas]);

  const aceitarEntrega = async (pedidoId: string) => {
    stopAlarm(); // Stop alarm when driver interacts
    if (!entregadorId) {
      toast({ title: "Erro", description: "Você não está cadastrado como entregador.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("pedidos")
      .update({ entregador_id: entregadorId, status: "em_rota" })
      .eq("id", pedidoId);

    if (error) {
      toast({ title: "Erro ao aceitar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entrega aceita!", description: "A entrega está em andamento." });
      setTabAtiva("aceitas");
      fetchEntregas();
    }
  };

  const confirmarInicioRota = async (veiculoId: number, veiculoPlaca: string, kmInicial: number) => {
    if (!entregaParaIniciar) return;

    const { error } = await supabase
      .from("pedidos")
      .update({ status: "em_rota" })
      .eq("id", entregaParaIniciar.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Rota iniciada!",
        description: `Veículo ${veiculoPlaca} - KM Inicial: ${kmInicial.toLocaleString("pt-BR")}`,
      });
      fetchEntregas();
    }
    setModalIniciarRota(false);
    setEntregaParaIniciar(null);
  };

  const pendentes = entregas.filter(e => e.status === "pendente");
  const emRota = entregas.filter(e => e.status === "em_rota");
  const todayStart = useMemo(() => startOfDay(getBrasiliaDate()).getTime(), []);
  const finalizadas = entregas.filter(e => e.status === "entregue" && new Date(e.created_at).getTime() >= todayStart);

  // Count deliveries per bairro for grouped indicator
  const bairroCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    const active = [...pendentes, ...emRota];
    active.forEach(e => {
      const b = e.clientes?.bairro;
      if (b) map[b] = (map[b] || 0) + 1;
    });
    return map;
  }, [pendentes, emRota]);

  const EmptyState = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p>{text}</p>
    </div>
  );

  return (
    <EntregadorLayout title="Entregas">
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-1">
            {!Capacitor.isNativePlatform() && permission !== "granted" && (
              <Button variant="outline" size="sm" onClick={requestPermission} className="text-xs">
                <BellRing className="h-4 w-4 mr-1" />
                Ativar Notificações
              </Button>
            )}
            {!Capacitor.isNativePlatform() && (
              <Button
                variant={alarmEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setAlarmEnabled(!alarmEnabled);
                  if (alarmEnabled) stopAlarm();
                }}
                className="text-xs"
              >
                {alarmEnabled ? <BellRing className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
                {alarmEnabled ? "Som Ativo" : "Som Mudo"}
              </Button>
            )}
            {isPlaying.current && (
              <Button variant="destructive" size="sm" onClick={stopAlarm} className="text-xs animate-pulse">
                🔔 Parar Alarme
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setIsLoading(true); fetchEntregas(); }}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <Tabs value={tabAtiva} onValueChange={(v) => { setTabAtiva(v); if (v === "pendentes") stopAlarm(); }}>
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="pendentes" className="relative text-xs sm:text-sm">
                Pendentes
                {pendentes.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                    {pendentes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="aceitas" className="text-xs sm:text-sm">Em Andamento</TabsTrigger>
              <TabsTrigger value="finalizadas" className="text-xs sm:text-sm">Finalizadas</TabsTrigger>
            </TabsList>

            <TabsContent value="pendentes" className="space-y-4 mt-0">
              {pendentes.length === 0 ? (
                <EmptyState icon={Package} text="Nenhuma entrega pendente" />
              ) : (
                pendentes.map(e => (
                  <EntregaCard
                    key={e.id}
                    entrega={e}
                    onAceitar={aceitarEntrega}
                    sameBairroCount={e.clientes?.bairro ? bairroCountMap[e.clientes.bairro] : undefined}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="aceitas" className="space-y-4 mt-0">
              {emRota.length === 0 ? (
                <EmptyState icon={Truck} text="Nenhuma entrega em andamento" />
              ) : (
                emRota.map(e => (
                  <EntregaCard
                    key={e.id}
                    entrega={e}
                    onAceitar={aceitarEntrega}
                    sameBairroCount={e.clientes?.bairro ? bairroCountMap[e.clientes.bairro] : undefined}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="finalizadas" className="space-y-4 mt-0">
              {finalizadas.length === 0 ? (
                <EmptyState icon={CheckCircle} text="Nenhuma entrega finalizada hoje" />
              ) : (
                finalizadas.map(e => <EntregaCard key={e.id} entrega={e} onAceitar={aceitarEntrega} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <IniciarRotaModal
        isOpen={modalIniciarRota}
        onClose={() => { setModalIniciarRota(false); setEntregaParaIniciar(null); }}
        onConfirm={confirmarInicioRota}
        entregaNome={entregaParaIniciar?.clientes?.nome}
      />
    </EntregadorLayout>
  );
}
