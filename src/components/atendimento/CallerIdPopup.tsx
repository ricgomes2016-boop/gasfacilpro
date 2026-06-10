import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Phone, MessageSquare, X, User, Clock, Truck, Eye, Battery, BatteryWarning, ShoppingCart, Navigation } from "lucide-react";
import { RepassarEntregadorDialog } from "./RepassarEntregadorDialog";
import { useNovaVendaWindows } from "@/contexts/NovaVendaWindowsContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { haversineDistance } from "@/lib/haversine";
import { toast } from "sonner";
import { useDesktopNotification } from "@/hooks/useDesktopNotification";

interface ChamadaRecebida {
  id: string;
  telefone: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo: string;
  status: string;
  created_at: string;
  pedido_gerado_id: string | null;
  observacoes: string | null;
  unidade_id?: string | null;
}

interface UltimoPedidoInfo {
  id: string;
  valor_total: number;
  created_at: string;
  status: string;
  endereco_entrega: string | null;
  forma_pagamento: string | null;
  canal_venda: string | null;
  itens: { produto_id: string; nome: string; quantidade: number; preco_unitario: number }[];
  entregador?: { id: string; nome: string; latitude?: number; longitude?: number; distanciaKm?: number } | null;
}

export function CallerIdPopup() {
  const [chamada, setChamada] = useState<ChamadaRecebida | null>(null);
  const [ultimoPedido, setUltimoPedido] = useState<UltimoPedidoInfo | null>(null);
  const [showRepassar, setShowRepassar] = useState(false);
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const { notify } = useDesktopNotification();
  const { openWindow: openNovaVendaWindow } = useNovaVendaWindows();

  const handleNovaChamada = useCallback(async (nova: ChamadaRecebida) => {
    setChamada(nova);
    setUltimoPedido(null);

    // Play a ringing sound if possible
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log("Audio play prevented", e));
    } catch(e) {}

    // Desktop notification SEMPRE (mesmo com aba visível) — garante visibilidade fora do sistema
    const tituloNotif = nova.pedido_gerado_id
      ? `🚚 Pedido confirmado - ${nova.cliente_nome || nova.telefone}`
      : `📞 Bia atendendo - ${nova.cliente_nome || nova.telefone}`;
    const corpoNotif = nova.pedido_gerado_id
      ? "A Bia registrou um novo pedido. Toque para visualizar."
      : "Chamada recebida. A Bia está atendendo o cliente.";
    notify(tituloNotif, corpoNotif);

    if (nova.pedido_gerado_id || nova.cliente_id) {
      const { data } = await supabase
        .from("pedidos")
        .select(`
          id, valor_total, created_at, status, endereco_entrega, forma_pagamento, canal_venda,
          entregadores:entregador_id(id, nome)
        `)
        .eq(nova.pedido_gerado_id ? "id" : "cliente_id", nova.pedido_gerado_id || nova.cliente_id)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data?.[0]) {
        const { data: itensData } = await supabase
          .from("pedido_itens")
          .select("produto_id, quantidade, preco_unitario, produtos(nome)")
          .eq("pedido_id", data[0].id);

        setUltimoPedido({
          ...data[0],
          entregador: (data[0] as any).entregadores,
          itens: (itensData || []).map((i: any) => ({
            produto_id: i.produto_id,
            nome: i.produtos?.nome || "Produto",
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          })),
        });

        // Async calculate distance for the UI
        if (nova.cliente_id && (data[0] as any).entregadores?.latitude) {
            const { data: cliente } = await supabase.from("clientes").select("latitude, longitude").eq("id", nova.cliente_id).maybeSingle();
            if (cliente?.latitude && (data[0] as any).entregadores.latitude) {
                const dist = haversineDistance(cliente.latitude, cliente.longitude, (data[0] as any).entregadores.latitude, (data[0] as any).entregadores.longitude);
                setUltimoPedido(prev => prev ? { 
                    ...prev, 
                    entregador: { ...prev.entregador!, distanciaKm: dist } 
                } : null);
            }
        }
      }
    }
  }, [notify]);

  // Auto-request notification permission once
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!unidadeAtual?.id) return;

    let lastSeenId: string | null = null;

    const checkRecentCalls = async () => {
      const since = new Date(Date.now() - 90000).toISOString();
      const { data } = await supabase
        .from("chamadas_recebidas")
        .select("*")
        .eq("status", "recebida")
        .eq("unidade_id", unidadeAtual.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data?.[0] && data[0].id !== lastSeenId) {
        lastSeenId = data[0].id;
        handleNovaChamada(data[0] as ChamadaRecebida);
      }
    };

    checkRecentCalls();
    const pollInterval = setInterval(checkRecentCalls, 5000);

    const channel = supabase
      .channel(`caller-id-${unidadeAtual.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chamadas_recebidas",
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        async (payload) => {
          const nova = (payload.new || payload.old) as ChamadaRecebida;
          if (!nova?.id) return;
          // Atualização: pedido foi linkado a uma chamada já exibida → atualiza o card atual
          if (payload.eventType === "UPDATE" && nova.pedido_gerado_id) {
            handleNovaChamada(nova);
            return;
          }
          // Nova chamada recebida (com ou sem pedido) → mostra popup imediato
          if (payload.eventType === "INSERT" && nova.status === "recebida") {
            if (nova.id === lastSeenId) return;
            lastSeenId = nova.id;
            handleNovaChamada(nova);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [handleNovaChamada, unidadeAtual?.id]);

  if (!chamada) {
    return null;
  }

  const handleVerPedido = () => {
    navigate(`/vendas/pedidos`);
    setChamada(null);
  };

  const handleNovaVenda = () => {
    const titulo = chamada.cliente_nome || chamada.telefone || "Nova Venda";
    openNovaVendaWindow({ clienteId: chamada.cliente_id || null, title: titulo });
    setChamada(null);
  };

  const handleVerPerfil = () => {
    if (chamada.cliente_id) {
      navigate(`/clientes/cadastro/${chamada.cliente_id}`);
    }
    setChamada(null);
  };

  const handleDismiss = async () => {
    await supabase
      .from("chamadas_recebidas")
      .update({ status: "atendida" })
      .eq("id", chamada.id);
    setChamada(null);
  };

  const batteryMatch = chamada.observacoes?.match(/Bateria:\s*(\d+)%/);
  const batteryLevel = batteryMatch ? parseInt(batteryMatch[1]) : null;
  const isBatteryLow = batteryLevel !== null && batteryLevel <= 15;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[380px] animate-in slide-in-from-right-10 duration-500">
      <Card className="border-none shadow-2xl bg-background/95 backdrop-blur-md border border-primary/20 overflow-hidden ring-1 ring-black/5">
        
        {/* Header - Compacto e Elegante */}
        <div className="bg-primary px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-white/20 ring-2 ring-white/10">
              {chamada.tipo === "whatsapp" ? (
                <MessageSquare className="h-5 w-5 text-white" />
              ) : (
                <Phone className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-primary-foreground/70 uppercase tracking-widest">
                Novo Pedido IA
              </p>
              <h2 className="text-sm font-bold text-white leading-tight">
                {chamada.cliente_nome || chamada.telefone}
              </h2>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full shrink-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-4 space-y-4">
          
          {/* Info do Histórico / Pedido Atual */}
          {ultimoPedido ? (
            <div className="bg-muted/50 rounded-lg p-3 border border-border/50 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Detalhes do Pedido</span>
                <span>{format(new Date(ultimoPedido.created_at), "HH:mm", { locale: ptBR })}</span>
              </div>
              
              <div className="space-y-1">
                {ultimoPedido.itens.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-semibold">
                    <span>{item.quantidade}x {item.nome}</span>
                    <span>R$ {(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-sm font-bold pt-1 border-t border-border/50 text-primary">
                <span>Total</span>
                <span>R$ {Number(ultimoPedido.valor_total).toFixed(2)}</span>
              </div>

              {ultimoPedido.endereco_entrega && (
                <div className="flex flex-col gap-1 pt-1 opacity-80">
                  <p className="text-[10px] text-muted-foreground leading-snug flex gap-1">
                    <Truck className="h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{ultimoPedido.endereco_entrega}</span>
                  </p>
                  {ultimoPedido.entregador && chamada.cliente_id && (
                    <p className="text-[10px] text-primary/80 font-bold flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      Distância: {ultimoPedido.entregador.id ? "Calculando..." : "N/A"}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed text-center p-4">
              <p className="text-xs text-muted-foreground italic">
                {chamada.pedido_gerado_id
                  ? "Buscando dados do pedido..."
                  : "📞 Bia em atendimento — aguardando o cliente confirmar o pedido..."}
              </p>
            </div>
          )}

          {/* Status de Entrega IA */}
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
             <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
               <Truck className="h-4 w-4 text-green-600" />
             </div>
             <div className="space-y-0.5">
               <p className="text-[11px] font-bold text-green-700 uppercase">Logística IA</p>
               <p className="text-xs text-green-600 font-medium leading-tight">
                 {ultimoPedido?.entregador?.nome 
                   ? `Encaminhado para ${ultimoPedido.entregador.nome} ${ultimoPedido.entregador.distanciaKm ? `(${ultimoPedido.entregador.distanciaKm.toFixed(1)}km)` : ""} ✅`
                   : "Aguardando entregador..."}
               </p>
             </div>
          </div>

          {/* Ações de Gestão */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button size="sm" className="col-span-2 h-10 font-bold bg-primary hover:bg-primary/90 gap-2 shadow-sm" onClick={() => setShowRepassar(true)}>
              <Truck className="h-4 w-4" />
              REPASSAR ENTREGADOR
            </Button>

            <Button variant="outline" size="sm" className="h-9 text-[11px] font-bold border-border/60 hover:bg-muted" onClick={handleVerPedido}>
              <Eye className="h-3 w-3 mr-1.5" />
              VISUALIZAR
            </Button>
            
            <Button variant="outline" size="sm" className="h-9 text-[11px] font-bold border-border/60 hover:bg-muted" onClick={handleVerPerfil}>
              <User className="h-3 w-3 mr-1.5" />
              HISTÓRICO
            </Button>

            {(!ultimoPedido?.endereco_entrega || ultimoPedido?.endereco_entrega.length < 5) && (
              <Button size="sm" variant="secondary" className="col-span-2 h-10 font-bold bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-200 gap-2" onClick={handleNovaVenda}>
                <ShoppingCart className="h-4 w-4" />
                COMPLETAR VENDA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Fallback hidden dialog for existing logic, if needed */}
      <RepassarEntregadorDialog
        open={showRepassar}
        onOpenChange={setShowRepassar}
        pedidoId={chamada.pedido_gerado_id}
        onSuccess={() => setChamada(null)}
      />
    </div>
  );
}
