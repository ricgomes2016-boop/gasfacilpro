import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Phone, MessageSquare, X, User, Clock, Truck, Eye, Battery, BatteryWarning, ShoppingCart } from "lucide-react";
import { RepassarEntregadorDialog } from "./RepassarEntregadorDialog";
import { NovaVendaModal } from "@/components/vendas/NovaVendaModal";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
}

export function CallerIdPopup() {
  const [chamada, setChamada] = useState<ChamadaRecebida | null>(null);
  const [ultimoPedido, setUltimoPedido] = useState<UltimoPedidoInfo | null>(null);
  const [showRepassar, setShowRepassar] = useState(false);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [vendaClienteId, setVendaClienteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();

  const handleNovaChamada = useCallback(async (nova: ChamadaRecebida) => {
    setChamada(nova);
    setUltimoPedido(null);

    // Play a ringing sound if possible
    try {
      const audio = new Audio('/notification.mp3'); // Fallback to notification sound
      audio.play().catch(e => console.log("Audio play prevented", e));
    } catch(e) {}

    if (nova.cliente_id) {
      const { data } = await supabase
        .from("pedidos")
        .select("id, valor_total, created_at, status, endereco_entrega, forma_pagamento, canal_venda")
        .eq("cliente_id", nova.cliente_id)
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
          itens: (itensData || []).map((i: any) => ({
            produto_id: i.produto_id,
            nome: i.produtos?.nome || "Produto",
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          })),
        });
      }
    }
  }, []);

  useEffect(() => {
    let lastSeenId: string | null = null;

    const checkRecentCalls = async () => {
      const since = new Date(Date.now() - 90000).toISOString();
      const { data } = await supabase
        .from("chamadas_recebidas")
        .select("*")
        .eq("status", "recebida")
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
      .channel("caller-id-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chamadas_recebidas" },
        async (payload) => {
          const nova = payload.new as ChamadaRecebida;
          lastSeenId = nova.id;
          handleNovaChamada(nova);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [handleNovaChamada]);

  if (!chamada) {
    return (
      <NovaVendaModal
        open={showVendaModal}
        onClose={() => setShowVendaModal(false)}
        clienteId={vendaClienteId}
      />
    );
  }

  const handleVerPedido = () => {
    navigate(`/vendas/pedidos`);
    setChamada(null);
  };

  const handleNovaVenda = () => {
    setVendaClienteId(chamada.cliente_id || null);
    setChamada(null);
    setShowVendaModal(true);
  };

  const handleVerPerfil = () => {
    if (chamada.cliente_id) {
      navigate(`/clientes/${chamada.cliente_id}`);
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
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300 p-4">
      <Card className="w-full max-w-2xl border-none shadow-2xl bg-background/95 backdrop-blur overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Superior Header (Warning/Info Bar) */}
        <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-white/20 animate-pulse ring-4 ring-white/10">
              {chamada.tipo === "whatsapp" ? (
                <MessageSquare className="h-8 w-8 text-white" />
              ) : (
                <Phone className="h-8 w-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {chamada.tipo === "whatsapp" ? "LIGAÇÃO WHATSAPP" : "LIGAÇÃO RECEBIDA"}
              </h2>
              <p className="text-primary-foreground/80 opacity-90">
                {format(new Date(chamada.created_at), "HH:mm:ss", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20 rounded-full" onClick={handleDismiss}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <CardContent className="p-8">
          
          {/* Main Content Area */}
          <div className="flex flex-col md:flex-row gap-8 items-start">
            
            {/* Left Col: Caller Info */}
            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-extrabold text-foreground">
                    {chamada.cliente_nome || chamada.telefone}
                  </span>
                  {chamada.cliente_id ? (
                    <Badge variant="default" className="text-sm px-3 py-1 uppercase tracking-wider bg-green-600">Cliente Recorrente</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-sm px-3 py-1 uppercase tracking-wider">Novo Cliente</Badge>
                  )}
                </div>
                {chamada.cliente_nome && (
                  <p className="text-xl text-muted-foreground font-medium">{chamada.telefone}</p>
                )}
              </div>

              {/* Último pedido detalhado */}
              {ultimoPedido ? (
                <div className="bg-muted/40 rounded-xl p-5 border border-border/50">
                  <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                    <span className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> COMPRA ANTERIOR
                    </span>
                    <span className="text-sm font-medium">
                      {format(new Date(ultimoPedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="space-y-2 mb-3">
                    {ultimoPedido.itens.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-base">
                        <span className="font-medium">{item.quantidade}x {item.nome}</span>
                        <span className="text-muted-foreground">
                          R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-border/50 pt-2 text-primary">
                    <span>Total</span>
                    <span>R$ {Number(ultimoPedido.valor_total).toFixed(2)}</span>
                  </div>
                  {ultimoPedido.endereco_entrega && (
                    <p className="text-sm text-muted-foreground mt-2 flex gap-1">
                      <Truck className="h-4 w-4 inline shrink-0" />
                      <span className="line-clamp-2">{ultimoPedido.endereco_entrega}</span>
                    </p>
                  )}
                </div>
              ) : (
                chamada.cliente_id && (
                  <div className="bg-muted/40 rounded-xl p-5 border border-border/50 flex flex-col items-center justify-center text-center h-full min-h-[140px]">
                    <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-muted-foreground font-medium">Nenhuma compra recente encontrada.</p>
                  </div>
                )
              )}
            </div>
            
            {/* Right Col: Actions & Devices */}
            <div className="w-full md:w-64 space-y-4 shrink-0">
              
              <Button size="lg" className="w-full h-16 text-lg font-bold gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg" onClick={handleNovaVenda}>
                <ShoppingCart className="h-6 w-6" />
                VENDER AGORA
              </Button>
              
              <Button size="lg" variant="outline" className="w-full h-14 font-semibold" onClick={handleVerPedido}>
                <Eye className="h-5 w-5 mr-2" />
                Ver Pedidos
              </Button>
              
              {chamada.cliente_id && (
                <Button size="lg" variant="ghost" className="w-full h-14 font-semibold bg-muted/50 hover:bg-muted" onClick={handleVerPerfil}>
                  <User className="h-5 w-5 mr-2" />
                  Perfil do Cliente
                </Button>
              )}
              
              {/* Bina Device Status */}
              {(batteryLevel !== null) && (
                <div className={`mt-6 p-4 rounded-xl border ${isBatteryLow ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/30 border-border/50'} flex items-start gap-3`}>
                  {isBatteryLow ? (
                    <BatteryWarning className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <Battery className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-bold ${isBatteryLow ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      Bateria do App Bina: {batteryLevel}%
                    </p>
                    {isBatteryLow && (
                      <p className="text-xs text-red-500/80 font-medium leading-tight mt-1">
                        Atenção: Conecte o celular do balcão ao carregador ou o identificador de chamadas irá desligar!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

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
