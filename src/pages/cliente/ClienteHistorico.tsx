import { useEffect, useState } from "react";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCliente } from "@/contexts/ClienteContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveAllClienteIdsForUser } from "@/lib/clienteAppLookup";
import { AvaliacaoEntregaDialog } from "@/components/cliente/AvaliacaoEntregaDialog";
import { 
  History, 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck,
  ShoppingBag,
  RotateCcw,
  MapPin,
  Star
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface PedidoDB {
  id: string;
  numero_sequencial: number | null;
  created_at: string;
  valor_total: number | null;
  status: string | null;
  forma_pagamento: string | null;
  endereco_entrega: string | null;
  entregador_id: string | null;
  pedido_itens: {
    id: string;
    quantidade: number;
    preco_unitario: number;
    produto_id: string | null;
    produtos: {
      nome: string;
      image_url: string | null;
    } | null;
  }[];
}

const statusConfig: Record<string, { label: string; badge: string; accent: string; icon: typeof Clock }> = {
  pendente: { label: "Pendente", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", accent: "from-amber-500/10 to-transparent", icon: Clock },
  em_rota: { label: "Em Rota", badge: "bg-primary/15 text-primary border-primary/30", accent: "from-primary/10 to-transparent", icon: Truck },
  entregue: { label: "Entregue", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", accent: "from-emerald-500/10 to-transparent", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", badge: "bg-destructive/15 text-destructive border-destructive/30", accent: "from-destructive/10 to-transparent", icon: Package },
};

export default function ClienteHistorico() {
  const { cartItemsCount, addToCart } = useCliente();
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avaliadosIds, setAvaliadosIds] = useState<Set<string>>(new Set());
  const [avaliacaoOpen, setAvaliacaoOpen] = useState(false);
  const [avaliacaoPedido, setAvaliacaoPedido] = useState<{ id: string; entregadorId: string | null } | null>(null);

  useEffect(() => {
    const fetchPedidos = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Resolve empresa do usuário (fonte de verdade para RLS)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const empresaId = (profileData as any)?.empresa_id || null;

        if (!empresaId) {
          setPedidos([]);
          return;
        }

        // Busca TODOS os cliente_ids do usuário na empresa (cache + telefone + email)
        const userPhone = (user as any)?.phone || (user.user_metadata as any)?.telefone || null;
        const clienteIds = await resolveAllClienteIdsForUser({
          userId: user.id,
          empresaId,
          email: user.email,
          phone: userPhone,
        });

        if (clienteIds.length === 0) {
          setPedidos([]);
          return;
        }

        const { data, error } = await supabase
          .from("pedidos")
          .select(`
            id, numero_sequencial, created_at, valor_total, status, forma_pagamento, endereco_entrega, entregador_id,
            pedido_itens (
              id, quantidade, preco_unitario, produto_id,
              produtos:produto_id (nome, image_url)
            )
          `)
          .in("cliente_id", clienteIds)
          .order("created_at", { ascending: false })
          .limit(50);


        if (!error && data) {
          setPedidos(data as unknown as PedidoDB[]);
        }
      } catch (err) {
        console.error("Erro ao buscar pedidos:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPedidos();

    // Fetch already reviewed pedidos
    const fetchAvaliados = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("avaliacoes_entrega")
        .select("pedido_id")
        .eq("user_id", user.id);
      if (data) {
        setAvaliadosIds(new Set(data.map(a => a.pedido_id).filter(Boolean) as string[]));
      }
    };
    fetchAvaliados();
  }, [user]);
  const handleRepetirPedido = (pedido: PedidoDB) => {
    pedido.pedido_itens.forEach(item => {
      if (item.produtos) {
        addToCart({
          id: item.produto_id || item.id,
          name: item.produtos.nome,
          description: "",
          price: item.preco_unitario,
          image: item.produtos.image_url || "📦",
          category: "",
        }, item.quantidade);
      }
    });
  };

  return (
    <ClienteLayout cartItemsCount={cartItemsCount}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Minhas Compras</h1>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <ShoppingBag className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{pedidos.length}</p>
              <p className="text-sm text-muted-foreground">Total de pedidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Truck className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold">
                {pedidos.filter(p => p.status === "entregue").length}
              </p>
              <p className="text-sm text-muted-foreground">Entregas realizadas</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : pedidos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold mb-1">Nenhuma compra ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Faça seu primeiro pedido agora!
              </p>
              <Button asChild>
                <Link to="/cliente">Ver Produtos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pedidos.map(pedido => {
              const status = statusConfig[pedido.status || "pendente"] || statusConfig.pendente;
              const StatusIcon = status.icon;
              
              return (
                <Card key={pedido.id} className={`relative overflow-hidden border-border/60 hover:shadow-md transition-shadow animate-fade-in`}>
                  <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${status.accent} pointer-events-none`} />
                  <CardContent className="p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                          #{pedido.numero_sequencial ?? pedido.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-sm font-medium">
                          {format(new Date(pedido.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="outline" className={`${status.badge} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-2 mb-3">
                      {pedido.pedido_itens.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-sm">
                            {item.produtos?.image_url ? (
                              <img src={item.produtos.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : "📦"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.produtos?.nome || "Produto"}</p>
                            <p className="text-sm text-muted-foreground">Qtd: {item.quantidade}</p>
                          </div>
                          <p className="font-medium">
                            R$ {(item.preco_unitario * item.quantidade).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-3" />

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Pago via {pedido.forma_pagamento || "—"}
                      </p>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-lg font-bold text-primary">
                          R$ {(pedido.valor_total || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 flex-wrap">
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2" 
                        size="sm"
                        onClick={() => handleRepetirPedido(pedido)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Repetir
                      </Button>
                      {pedido.status === "entregue" && !avaliadosIds.has(pedido.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2 border-amber-300 text-amber-600 hover:bg-amber-50"
                          onClick={() => {
                            setAvaliacaoPedido({ id: pedido.id, entregadorId: pedido.entregador_id });
                            setAvaliacaoOpen(true);
                          }}
                        >
                          <Star className="h-4 w-4" />
                          Avaliar
                        </Button>
                      )}
                      {pedido.status === "entregue" && avaliadosIds.has(pedido.id) && (
                        <Badge variant="secondary" className="gap-1 self-center">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          Avaliado
                        </Badge>
                      )}
                      {pedido.status !== "entregue" && pedido.status !== "cancelado" && (
                        <Button asChild variant="default" size="sm" className="flex-1 gap-1">
                          <Link to={`/cliente/rastreamento/${pedido.id}`}>
                            <MapPin className="h-4 w-4" />
                            Rastrear
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Avaliação Dialog */}
      {avaliacaoPedido && (
        <AvaliacaoEntregaDialog
          open={avaliacaoOpen}
          onClose={() => {
            setAvaliacaoOpen(false);
            if (avaliacaoPedido) {
              setAvaliadosIds(prev => new Set([...prev, avaliacaoPedido.id]));
            }
            setAvaliacaoPedido(null);
          }}
          pedidoId={avaliacaoPedido.id}
          entregadorId={avaliacaoPedido.entregadorId}
        />
      )}
    </ClienteLayout>
  );
}
