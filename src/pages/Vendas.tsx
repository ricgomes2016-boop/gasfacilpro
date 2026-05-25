import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, ShoppingCart, TrendingUp, Store, Plus, List, Clock, 
  Calendar, FileBarChart, CreditCard, Megaphone, Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { VendasPorHoraChart } from "@/components/vendas/VendasPorHoraChart";
import { useUnidade } from "@/contexts/UnidadeContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_preparo: { label: "Em Preparo", variant: "outline" },
  em_rota: { label: "Em Rota", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

type Periodo = "hoje" | "semana" | "mes";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(187, 65%, 50%)",
  "hsl(210, 60%, 55%)",
];

export default function Vendas() {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const today = getBrasiliaDate();

  const { dataInicio, dataFim } = useMemo(() => {
    const fim = endOfDay(today);
    let inicio: Date;
    switch (periodo) {
      case "semana": inicio = startOfWeek(today, { weekStartsOn: 0 }); break;
      case "mes": inicio = startOfMonth(today); break;
      default: inicio = startOfDay(today);
    }
    return { dataInicio: inicio, dataFim: fim };
  }, [periodo]);

  // Previous period for comparison (#3)
  const { dataInicioAnterior, dataFimAnterior } = useMemo(() => {
    switch (periodo) {
      case "semana": {
        const prev = subWeeks(dataInicio, 1);
        return { dataInicioAnterior: prev, dataFimAnterior: subWeeks(dataFim, 1) };
      }
      case "mes": {
        const prev = subMonths(dataInicio, 1);
        return { dataInicioAnterior: prev, dataFimAnterior: subMonths(dataFim, 1) };
      }
      default: {
        const prev = subDays(dataInicio, 1);
        return { dataInicioAnterior: prev, dataFimAnterior: subDays(dataFim, 1) };
      }
    }
  }, [dataInicio, dataFim, periodo]);

  // Fetch current period orders (#2 - filtered by unidade)
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["vendas-periodo", periodo, unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select(`*, clientes (nome), pedido_itens (quantidade, preco_unitario, produtos (nome))`)
        .gte("created_at", dataInicio.toISOString())
        .lte("created_at", dataFim.toISOString())
        .order("created_at", { ascending: false });

      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch previous period for comparison (#3)
  const { data: pedidosAnterior = [] } = useQuery({
    queryKey: ["vendas-anterior", periodo, unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select("valor_total, status")
        .gte("created_at", dataInicioAnterior.toISOString())
        .lte("created_at", dataFimAnterior.toISOString());

      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  // Current metrics
  const validPedidos = pedidos.filter((p: any) => p.status !== "cancelado");
  const totalVendas = validPedidos.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
  const totalPedidos = pedidos.length;
  const pedidosPendentes = pedidos.filter((p: any) => ["pendente", "em_preparo", "em_rota"].includes(p.status || "")).length;
  const ticketMedio = validPedidos.length > 0 ? totalVendas / validPedidos.length : 0;

  // Previous metrics (#3)
  const validAnterior = pedidosAnterior.filter((p: any) => p.status !== "cancelado");
  const vendasAnterior = validAnterior.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
  const pedidosAnteriorCount = pedidosAnterior.length;

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return undefined;
    const pct = ((current - previous) / previous) * 100;
    return { value: Math.round(Math.abs(pct)), isPositive: pct >= 0 };
  };

  const trendVendas = calcTrend(totalVendas, vendasAnterior);
  const trendPedidos = calcTrend(totalPedidos, pedidosAnteriorCount);

  // Top 5 products (#4)
  const topProducts = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    validPedidos.forEach((p: any) => {
      (p.pedido_itens || []).forEach((item: any) => {
        const nome = item.produtos?.nome || "Produto";
        const entry = map.get(nome) || { nome, qtd: 0, valor: 0 };
        entry.qtd += item.quantidade || 1;
        entry.valor += (item.preco_unitario || 0) * (item.quantidade || 1);
        map.set(nome, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [validPedidos]);

  // Sales by channel (#5)
  const salesByChannel = useMemo(() => {
    const map = new Map<string, number>();
    validPedidos.forEach((p: any) => {
      const canal = p.canal_venda || "Não informado";
      map.set(canal, (map.get(canal) || 0) + (p.valor_total || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [validPedidos]);

  // Sales by payment method (#6)
  const salesByPayment = useMemo(() => {
    const map = new Map<string, number>();
    validPedidos.forEach((p: any) => {
      const method = p.forma_pagamento || "Não informado";
      map.set(method, (map.get(method) || 0) + (p.valor_total || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [validPedidos]);

  const ultimosPedidos = pedidos.slice(0, 5);

  const periodoLabel = { hoje: "Hoje", semana: "Semana", mes: "Mês" }[periodo];
  const periodoCompLabel = { hoje: "ontem", semana: "semana anterior", mes: "mês anterior" }[periodo];

  return (
    <MainLayout>
      <Header title="Vendas" subtitle={`Visão geral das vendas - ${periodoLabel}`} />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Period filter (#8 base) */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <TabsList>
              <TabsTrigger value="hoje" className="text-xs sm:text-sm">Hoje</TabsTrigger>
              <TabsTrigger value="semana" className="text-xs sm:text-sm">Semana</TabsTrigger>
              <TabsTrigger value="mes" className="text-xs sm:text-sm">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Metric cards with trend (#3) */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-primary/10 p-2 md:p-3">
                <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Vendas</p>
                <p className="text-lg md:text-2xl font-bold truncate">
                  R$ {totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                {trendVendas && (
                  <p className={`text-xs font-medium ${trendVendas.isPositive ? "text-success" : "text-destructive"}`}>
                    {trendVendas.isPositive ? "+" : "-"}{trendVendas.value}% vs {periodoCompLabel}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-info/10 p-2 md:p-3">
                <ShoppingCart className="h-5 w-5 md:h-6 md:w-6 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Pedidos</p>
                <p className="text-lg md:text-2xl font-bold">{totalPedidos}</p>
                {trendPedidos && (
                  <p className={`text-xs font-medium ${trendPedidos.isPositive ? "text-success" : "text-destructive"}`}>
                    {trendPedidos.isPositive ? "+" : "-"}{trendPedidos.value}% vs {periodoCompLabel}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-success/10 p-2 md:p-3">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-lg md:text-2xl font-bold truncate">
                  R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-warning/10 p-2 md:p-3">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">Pendentes</p>
                <p className="text-lg md:text-2xl font-bold">{pedidosPendentes}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions + Reports button (#4, #7) */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-4">
          <Button size="lg" className="h-14 gap-2 text-sm" onClick={() => navigate("/vendas/pdv")}>
            <Store className="h-5 w-5" /> Abrir PDV
          </Button>
          <Button size="lg" variant="secondary" className="h-14 gap-2 text-sm" onClick={() => navigate("/vendas/nova")}>
            <Plus className="h-5 w-5" /> Nova Venda
          </Button>
          <Button size="lg" variant="outline" className="h-14 gap-2 text-sm" onClick={() => navigate("/vendas/pedidos")}>
            <List className="h-5 w-5" /> Ver Pedidos
          </Button>
          <Button size="lg" variant="outline" className="h-14 gap-2 text-sm" onClick={() => navigate("/vendas/relatorio")}>
            <FileBarChart className="h-5 w-5" /> Relatórios
          </Button>
        </div>

        {/* Chart for all periods (#8) */}
        <VendasPorHoraChart pedidos={pedidos} isLoading={isLoading} periodo={periodo} />

        {/* Top Products (#4) + Channel (#5) + Payment (#6) */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Top 5 Products */}
          <Card>
            <CardHeader className="section-header-stock pb-3">
              <CardTitle className="section-header-title">
                <Package className="h-4 w-4" /> Top Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.nome} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <span className="text-sm truncate">{p.nome}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{p.qtd}x</p>
                        <p className="text-xs text-muted-foreground">R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales by Channel (#5) */}
          <Card>
            <CardHeader className="section-header-catalog pb-3">
              <CardTitle className="section-header-title">
                <Megaphone className="h-4 w-4" /> Por Canal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesByChannel.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={salesByChannel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                        {salesByChannel.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {salesByChannel.map((c, i) => (
                      <span key={c.name} className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales by Payment (#6) */}
          <Card>
            <CardHeader className="section-header-finance pb-3">
              <CardTitle className="section-header-title">
                <CreditCard className="h-4 w-4" /> Por Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesByPayment.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={salesByPayment} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                        {salesByPayment.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {salesByPayment.map((c, i) => (
                      <span key={c.name} className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent orders */}
        <Card>
          <CardHeader className="section-header-catalog flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="section-header-title min-w-0">
              <ShoppingCart className="h-4 w-4 shrink-0" /> <span className="truncate">Últimos Pedidos</span>
            </CardTitle>
            <Button variant="ghost" size="sm" className="shrink-0 text-info-foreground hover:bg-info-foreground/10 hover:text-info-foreground" onClick={() => navigate("/vendas/pedidos")}>Ver todos</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : ultimosPedidos.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum pedido no período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Itens</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimosPedidos.map((pedido: any) => (
                    <TableRow key={pedido.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/vendas/pedidos")}>
                      <TableCell className="font-medium text-xs md:text-sm">
                        {format(new Date(pedido.created_at), periodo === "hoje" ? "HH:mm" : "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs md:text-sm">
                        {pedido.clientes?.nome || "Não identificado"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs md:text-sm">
                        {pedido.pedido_itens?.length || 0} item(s)
                      </TableCell>
                      <TableCell className="font-semibold text-xs md:text-sm">
                        R$ {(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs">{pedido.forma_pagamento || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[pedido.status || "pendente"]?.variant || "secondary"} className="text-xs">
                          {statusConfig[pedido.status || "pendente"]?.label || pedido.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
