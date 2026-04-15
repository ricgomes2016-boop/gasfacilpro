import { useState, useCallback, useEffect, useMemo } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  CheckCircle,
  MapPin,
  User,
  CalendarIcon,
  Search,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EntregaHistorico {
  id: string;
  created_at: string;
  valor_total: number | null;
  status: string | null;
  forma_pagamento: string | null;
  endereco_entrega: string | null;
  clientes: {
    nome: string;
    bairro: string | null;
  } | null;
  pedido_itens: {
    id: string;
    quantidade: number;
    preco_unitario: number;
    produtos: {
      nome: string;
    } | null;
  }[];
}

export default function EntregadorHistorico() {
  const [entregas, setEntregas] = useState<EntregaHistorico[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date>(subDays(new Date(), 7));
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchHistorico = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entregador) {
        setIsLoading(false);
        return;
      }

      setEntregadorId(entregador.id);

      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, created_at, valor_total, status, forma_pagamento, endereco_entrega,
          clientes:cliente_id (nome, bairro),
          pedido_itens (
            id, quantidade, preco_unitario,
            produtos:produto_id (nome)
          )
        `)
        .eq("entregador_id", entregador.id)
        .in("status", ["entregue", "finalizado"])
        .gte("created_at", startOfDay(dataInicio).toISOString())
        .lte("created_at", endOfDay(dataFim).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setEntregas(data as unknown as EntregaHistorico[]);
      }
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, dataInicio, dataFim]);

  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);

  const totalValor = entregas.reduce((sum, e) => sum + (e.valor_total || 0), 0);
  const totalEntregas = entregas.length;

  // Resumo de produtos vendidos
  const resumoProdutos = useMemo(() => {
    const map: Record<string, number> = {};
    entregas.forEach((e) => {
      e.pedido_itens.forEach((item) => {
        const nome = item.produtos?.nome || "Produto";
        map[nome] = (map[nome] || 0) + item.quantidade;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entregas]);

  // Resumo por forma de pagamento
  const resumoPagamento = useMemo(() => {
    const map: Record<string, { qtd: number; valor: number }> = {};
    entregas.forEach((e) => {
      const fp = e.forma_pagamento || "Não informado";
      if (!map[fp]) map[fp] = { qtd: 0, valor: 0 };
      map[fp].qtd += 1;
      map[fp].valor += e.valor_total || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].valor - a[1].valor);
  }, [entregas]);

  const getProductsSummary = (itens: EntregaHistorico["pedido_itens"]) => {
    return itens.map(i => `${i.quantidade}x ${i.produtos?.nome || "Produto"}`).join(", ");
  };

  return (
    <EntregadorLayout title="Histórico">
      <div className="p-4 space-y-4">
        {/* Date Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por período</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal text-sm h-9")}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(dataInicio, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataInicio}
                      onSelect={(date) => date && setDataInicio(date)}
                      locale={ptBR}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal text-sm h-9")}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(dataFim, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFim}
                      onSelect={(date) => date && setDataFim(date)}
                      locale={ptBR}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entregas</p>
                <p className="text-xl font-bold">{isLoading ? "—" : totalEntregas}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">
                  {isLoading ? "—" : `R$ ${totalValor.toFixed(2)}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo para Acerto Financeiro */}
        {!isLoading && entregas.length > 0 && (
          <>
            {/* Produtos Vendidos */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Produtos Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {resumoProdutos.map(([nome, qtd]) => (
                    <div key={nome} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{nome}</span>
                      <Badge variant="secondary" className="ml-2 font-bold">{qtd}</Badge>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Total de itens</span>
                  <span>{resumoProdutos.reduce((s, [, q]) => s + q, 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Forma de Pagamento */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Resumo por Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {resumoPagamento.map(([forma, { qtd, valor }]) => (
                    <div key={forma} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{forma}</span>
                        <Badge variant="outline" className="text-xs">{qtd}x</Badge>
                      </div>
                      <span className="font-bold">R$ {valor.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Total Geral</span>
                  <span className="text-primary">R$ {totalValor.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : entregas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma entrega encontrada no período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entregas.map((entrega) => {
              const clienteNome = entrega.clientes?.nome || "Cliente";
              const bairro = entrega.clientes?.bairro || "";

              return (
                <Card key={entrega.id} className="border-none shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{clienteNome}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entrega.created_at), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          R$ {(entrega.valor_total || 0).toFixed(2)}
                        </p>
                        <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Entregue
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1 mt-2">
                      {entrega.endereco_entrega && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{entrega.endereco_entrega}</span>
                          {bairro && (
                            <Badge variant="outline" className="text-xs ml-1 py-0">
                              {bairro}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        <span className="truncate">{getProductsSummary(entrega.pedido_itens)}</span>
                      </div>
                      {entrega.forma_pagamento && (
                        <p className="text-xs text-muted-foreground">
                          💳 {entrega.forma_pagamento}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </EntregadorLayout>
  );
}
