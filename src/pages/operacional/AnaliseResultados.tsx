import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, FileText, Calculator, TrendingUp, TrendingDown, DollarSign, Target, ArrowUpRight, ArrowDownRight, Percent, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import ResultadoOperacional from "./ResultadoOperacional";
import DRE from "./DRE";
import PontoEquilibrio from "./PontoEquilibrio";

interface OverviewData {
  receitaMesAtual: number;
  receitaMesAnterior: number;
  despesasMesAtual: number;
  despesasMesAnterior: number;
  lucroMesAtual: number;
  lucroMesAnterior: number;
  totalPedidos: number;
  ticketMedio: number;
  margemBruta: number;
  evolucao: { mes: string; receita: number; despesa: number; lucro: number }[];
  despesasPorCategoria: { name: string; value: number; color: string }[];
}

const COLORS = [
  "hsl(187, 65%, 38%)",
  "hsl(215, 90%, 52%)",
  "hsl(152, 69%, 40%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 55%)",
  "hsl(30, 80%, 50%)",
  "hsl(190, 80%, 45%)",
];

const mesesOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: format(new Date(2025, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
}));

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function VariationBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isPositive = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-600" : "text-destructive"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function AnaliseResultados() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const now = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(String(now.getMonth()));
  const [anoSelecionado, setAnoSelecionado] = useState(String(now.getFullYear()));

  useEffect(() => {
    fetchOverview();
  }, [unidadeAtual, mesSelecionado, anoSelecionado]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const mes = Number(mesSelecionado);
      const ano = Number(anoSelecionado);
      const mesAtualDate = new Date(ano, mes, 1);
      const mesAnteriorDate = subMonths(mesAtualDate, 1);

      const inicioAtual = startOfMonth(mesAtualDate).toISOString();
      const fimAtual = endOfMonth(mesAtualDate).toISOString();
      const inicioAnterior = startOfMonth(mesAnteriorDate).toISOString();
      const fimAnterior = endOfMonth(mesAnteriorDate).toISOString();

      // Fetch current and previous month data in parallel
      const buildPedidosQuery = (start: string, end: string) => {
        let q = supabase.from("pedidos").select("valor_total, status").gte("created_at", start).lte("created_at", end).neq("status", "cancelado");
        if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
        return q;
      };
      const buildMovQuery = (start: string, end: string) => {
        let q = supabase.from("movimentacoes_caixa").select("valor, categoria, descricao, tipo").eq("tipo", "saida").gte("created_at", start).lte("created_at", end);
        if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
        return q;
      };

      const inicioDate = format(mesAtualDate, "yyyy-MM-dd");
      const fimDate = format(endOfMonth(mesAtualDate), "yyyy-MM-dd");
      let cpq = supabase.from("contas_pagar").select("valor, categoria").eq("status", "pago").gte("vencimento", inicioDate).lte("vencimento", fimDate);
      if (unidadeAtual?.id) cpq = cpq.eq("unidade_id", unidadeAtual.id);

      // Also fetch contas_pagar for previous month
      const inicioAnteriorDate = format(mesAnteriorDate, "yyyy-MM-dd");
      const fimAnteriorDate = format(endOfMonth(mesAnteriorDate), "yyyy-MM-dd");
      let cpqAnterior = supabase.from("contas_pagar").select("valor").eq("status", "pago").gte("vencimento", inicioAnteriorDate).lte("vencimento", fimAnteriorDate);
      if (unidadeAtual?.id) cpqAnterior = cpqAnterior.eq("unidade_id", unidadeAtual.id);

      const [
        { data: pedidosAtual },
        { data: pedidosAnterior },
        { data: despesasAtual },
        { data: despesasAnterior },
        { data: contasPagarAtual },
        { data: contasPagarAnterior },
      ] = await Promise.all([
        buildPedidosQuery(inicioAtual, fimAtual),
        buildPedidosQuery(inicioAnterior, fimAnterior),
        buildMovQuery(inicioAtual, fimAtual),
        buildMovQuery(inicioAnterior, fimAnterior),
        cpq,
        cpqAnterior,
      ]);

      const receitaMesAtual = (pedidosAtual || []).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
      const receitaMesAnterior = (pedidosAnterior || []).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
      const totalPedidos = (pedidosAtual || []).length;
      const ticketMedio = totalPedidos > 0 ? receitaMesAtual / totalPedidos : 0;

      // Aggregate expenses
      const despMov = (despesasAtual || []).reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const despCP = (contasPagarAtual || []).reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const despesasMesAtual = despMov + despCP;
      const despMovAnterior = (despesasAnterior || []).reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const despCPAnterior = (contasPagarAnterior || []).reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const despesasMesAnterior = despMovAnterior + despCPAnterior;

      const lucroMesAtual = receitaMesAtual - despesasMesAtual;
      const lucroMesAnterior = receitaMesAnterior - despesasMesAnterior;
      const margemBruta = receitaMesAtual > 0 ? (lucroMesAtual / receitaMesAtual) * 100 : 0;

      // Expenses by category
      const catMap: Record<string, number> = {};
      (despesasAtual || []).forEach(d => {
        const cat = (d.categoria || d.descricao || "Outros").toString();
        const catName = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        catMap[catName] = (catMap[catName] || 0) + (Number(d.valor) || 0);
      });
      (contasPagarAtual || []).forEach(d => {
        const cat = (d.categoria || "Outros").toString();
        const catName = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        catMap[catName] = (catMap[catName] || 0) + (Number(d.valor) || 0);
      });
      const despesasPorCategoria = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

      // Evolution last 6 months - batch all queries then resolve
      const evolQueries = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(mesAtualDate, i);
        const ini = startOfMonth(d).toISOString();
        const fim = endOfMonth(d).toISOString();
        const iniDate = format(startOfMonth(d), "yyyy-MM-dd");
        const fimDateEv = format(endOfMonth(d), "yyyy-MM-dd");
        let pq = supabase.from("pedidos").select("valor_total").gte("created_at", ini).lte("created_at", fim).neq("status", "cancelado");
        let dq = supabase.from("movimentacoes_caixa").select("valor").eq("tipo", "saida").gte("created_at", ini).lte("created_at", fim);
        let cpqEv = supabase.from("contas_pagar").select("valor").eq("status", "pago").gte("vencimento", iniDate).lte("vencimento", fimDateEv);
        if (unidadeAtual?.id) {
          pq = pq.eq("unidade_id", unidadeAtual.id);
          dq = dq.eq("unidade_id", unidadeAtual.id);
          cpqEv = cpqEv.eq("unidade_id", unidadeAtual.id);
        }
        evolQueries.push({ d, pq, dq, cpqEv });
      }

      const evolResults = await Promise.all(
        evolQueries.map(({ pq, dq, cpqEv }) => Promise.all([pq, dq, cpqEv]))
      );

      const evolucao: OverviewData["evolucao"] = evolResults.map(([ { data: peds }, { data: desps }, { data: bills } ], idx) => {
        const rec = (peds || []).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
        const despMov2 = (desps || []).reduce((s, dd) => s + (Number(dd.valor) || 0), 0);
        const despCP2 = (bills || []).reduce((s, dd) => s + (Number(dd.valor) || 0), 0);
        const desp = despMov2 + despCP2;
        return {
          mes: format(evolQueries[idx].d, "MMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
          receita: rec,
          despesa: desp,
          lucro: rec - desp,
        };
      });

      setOverview({
        receitaMesAtual, receitaMesAnterior,
        despesasMesAtual, despesasMesAnterior,
        lucroMesAtual, lucroMesAnterior,
        totalPedidos, ticketMedio, margemBruta,
        evolucao, despesasPorCategoria,
      });
    } catch (e) {
      console.error("AnaliseResultados fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const mesLabel = format(new Date(Number(anoSelecionado), Number(mesSelecionado), 1), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());

  return (
    <MainLayout>
      <Header title="Análise de Resultados" subtitle="Visão completa da performance financeira e operacional" />
      <div className="p-3 sm:p-4 md:p-6 space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">

        {/* Period Selector */}
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full min-w-0">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="h-10 min-w-0 flex-1 sm:flex-none sm:w-40"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {mesesOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
            <SelectTrigger className="h-10 w-28 min-w-0"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs font-normal max-w-full truncate">
            {mesLabel}
          </Badge>
        </div>

        {/* Overview KPIs */}
        {loading ? (
          <PageSectionLoader label="Carregando análise..." className="min-h-48" />
        ) : overview && (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 w-full min-w-0">
              {/* Receita */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <VariationBadge current={overview.receitaMesAtual} previous={overview.receitaMesAnterior} />
                  </div>
                  <p className="text-xl md:text-2xl font-bold mt-2 tabular-nums">
                    {formatCurrency(overview.receitaMesAtual)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Receita</p>
                </CardContent>
              </Card>

              {/* Despesas */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    </div>
                    <VariationBadge current={overview.despesasMesAnterior} previous={overview.despesasMesAtual} />
                  </div>
                  <p className="text-xl md:text-2xl font-bold mt-2 tabular-nums">
                    {formatCurrency(overview.despesasMesAtual)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Despesas</p>
                </CardContent>
              </Card>

              {/* Resultado */}
              <Card className="relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${overview.lucroMesAtual >= 0 ? "from-primary/5" : "from-destructive/5"} to-transparent pointer-events-none`} />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className={`p-2 rounded-lg ${overview.lucroMesAtual >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                      {overview.lucroMesAtual >= 0 
                        ? <TrendingUp className="h-4 w-4 text-primary" /> 
                        : <TrendingDown className="h-4 w-4 text-destructive" />}
                    </div>
                    <VariationBadge current={overview.lucroMesAtual} previous={overview.lucroMesAnterior} />
                  </div>
                  <p className={`text-xl md:text-2xl font-bold mt-2 tabular-nums ${overview.lucroMesAtual >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {formatCurrency(overview.lucroMesAtual)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Resultado</p>
                </CardContent>
              </Card>

              {/* Ticket Médio */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Target className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs text-muted-foreground">{overview.totalPedidos} pedidos</span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold mt-2 tabular-nums">
                    R$ {overview.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ticket Médio</p>
                </CardContent>
              </Card>

              {/* Margem */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Percent className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                  <p className={`text-xl md:text-2xl font-bold mt-2 tabular-nums ${overview.margemBruta >= 0 ? "" : "text-destructive"}`}>
                    {overview.margemBruta.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Margem</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-5 w-full min-w-0">
              {/* Evolution Chart */}
              <Card className="lg:col-span-3 min-w-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Evolução 6 meses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={overview.evolucao}>
                      <defs>
                        <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                          name === "receita" ? "Receita" : name === "despesa" ? "Despesas" : "Lucro"
                        ]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="receita" stroke="hsl(152, 69%, 40%)" fill="url(#gradReceita)" strokeWidth={2} />
                      <Area type="monotone" dataKey="despesa" stroke="hsl(0, 72%, 51%)" fill="url(#gradDespesa)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pie Chart - Expenses */}
              <Card className="lg:col-span-2 min-w-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Despesas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {overview.despesasPorCategoria.length === 0 ? (
                    <EmptyState
                      compact
                      icon={FileText}
                      title="Sem despesas categorizadas"
                      description="As despesas pagas do período serão agrupadas aqui por categoria."
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={overview.despesasPorCategoria}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {overview.despesasPorCategoria.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 w-full">
                        {overview.despesasPorCategoria.slice(0, 6).map((cat, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs truncate">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="truncate text-muted-foreground">{cat.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Detailed Tabs */}
        <Tabs defaultValue="resultado" className="space-y-4 w-full min-w-0 max-w-full overflow-hidden">
          <TabsList className="grid w-full min-w-0 grid-cols-3 lg:w-auto lg:inline-grid h-auto p-1">
            <TabsTrigger value="resultado" className="flex min-w-0 items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Resultado Operacional</span>
              <span className="sm:hidden">RO</span>
            </TabsTrigger>
            <TabsTrigger value="dre" className="flex min-w-0 items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              <span>DRE</span>
            </TabsTrigger>
            <TabsTrigger value="equilibrio" className="flex min-w-0 items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2.5 text-xs sm:text-sm">
              <Calculator className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Ponto de Equilíbrio</span>
              <span className="sm:hidden">PE</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resultado" className="w-full min-w-0 max-w-full overflow-hidden">
            <ResultadoOperacional embedded />
          </TabsContent>
          <TabsContent value="dre" className="w-full min-w-0 max-w-full overflow-hidden">
            <DRE embedded />
          </TabsContent>
          <TabsContent value="equilibrio" className="w-full min-w-0 max-w-full overflow-hidden">
            <PontoEquilibrio embedded />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
