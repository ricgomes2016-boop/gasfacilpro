import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Phone, MessageSquare, X, ShoppingCart, User, Clock, RotateCcw, Copy, Truck, Eye } from "lucide-react";
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
  const [repetindo, setRepetindo] = useState(false);
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();

  const handleNovaChamada = useCallback(async (nova: ChamadaRecebida) => {
    setChamada(nova);
    setUltimoPedido(null);

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

    // Popup permanece visível até o usuário clicar para dispensar
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

  if (!chamada) return null;

  const handleVerPedido = () => {
    if (chamada.pedido_gerado_id) {
      navigate(`/vendas/pedidos`);
    } else {
      navigate(`/vendas/pedidos`);
    }
    setChamada(null);
  };

  const handleRepassarEntregador = () => {
    navigate(`/vendas/pedidos`);
    setChamada(null);
  };

  const handleRepetirPedido = async () => {
    if (!ultimoPedido || !chamada.cliente_id) return;
    setRepetindo(true);
    try {
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: chamada.cliente_id,
          endereco_entrega: ultimoPedido.endereco_entrega,
          valor_total: ultimoPedido.valor_total,
          forma_pagamento: ultimoPedido.forma_pagamento,
          canal_venda: "telefone",
          status: "pendente",
          unidade_id: unidadeAtual?.id || null,
          observacoes: `Repetição do pedido anterior`,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (ultimoPedido.itens.length > 0) {
        await supabase.from("pedido_itens").insert(
          ultimoPedido.itens.map((i) => ({
            pedido_id: pedido.id,
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          }))
        );
      }

      await supabase
        .from("chamadas_recebidas")
        .update({ status: "atendida", pedido_gerado_id: pedido.id })
        .eq("id", chamada.id);

      toast.success("Pedido repetido com sucesso!");
      setChamada(null);
      navigate("/vendas/pedidos");
    } catch (err) {
      console.error("Erro ao repetir pedido:", err);
      toast.error("Erro ao repetir pedido");
    } finally {
      setRepetindo(false);
    }
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

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-right-5 duration-300">
      <Card className="w-[400px] border-2 border-primary shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-500/10 animate-pulse">
                {chamada.tipo === "whatsapp" ? (
                  <MessageSquare className="h-5 w-5 text-green-600" />
                ) : (
                  <Phone className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {chamada.tipo === "whatsapp" ? "WhatsApp" : "Chamada"} recebida
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(chamada.created_at), "HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {chamada.cliente_nome || chamada.telefone}
              </span>
              {chamada.cliente_id ? (
                <Badge variant="default" className="text-xs">Cliente</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Novo</Badge>
              )}
            </div>

            {chamada.cliente_nome && (
              <p className="text-sm text-muted-foreground">{chamada.telefone}</p>
            )}

            {/* Último pedido detalhado */}
            {ultimoPedido && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Último pedido
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ultimoPedido.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="space-y-1">
                  {ultimoPedido.itens.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantidade}x {item.nome}</span>
                      <span className="font-mono text-muted-foreground">
                        R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-1">
                  <span>Total</span>
                  <span>R$ {Number(ultimoPedido.valor_total).toFixed(2)}</span>
                </div>
                {ultimoPedido.forma_pagamento && (
                  <p className="text-xs text-muted-foreground">
                    Pagamento: {ultimoPedido.forma_pagamento}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" className="flex-1 gap-1.5" onClick={handleRepassarEntregador}>
              <Truck className="h-3.5 w-3.5" />
              Repassar Entregador
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={handleVerPedido}>
              <Eye className="h-3.5 w-3.5" />
              Ver Pedido
            </Button>
            {chamada.cliente_id && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={handleVerPerfil}>
                <User className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
