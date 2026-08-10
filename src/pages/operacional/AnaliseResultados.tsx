import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import {
  CHART_SEMANTIC,
  chartAxisTick,
  chartColor,
  chartGridProps,
  fmtBRL,
  fmtBRLcompact,
} from "@/components/dashboard/premium/chartTheme";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calculator,
  Calendar,
  CircleDollarSign,
  DollarSign,
  FileText,
  Gauge,
  PackageCheck,
  Percent,
  ReceiptText,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import ResultadoOperacional from "./ResultadoOperacional";
import DRE from "./DRE";
import PontoEquilibrio from "./PontoEquilibrio";
import { isDespesaOperacionalResultado } from "@/lib/financeiro/despesasResultado";

interface OverviewData {
  receitaMesAtual: number;
  receitaMesAnterior: number;
  despesasMesAtual: number;
  despesasMesAnterior: number;
  resultadoMesAtual: number;
  resultadoMesAnterior: number;
  totalPedidos: number;
  ticketMedio: number;
  margemLiquida: number;
  contasPagas: number;
  despesasAvulsas: number;
  evolucao: { mes: string; receita: number; despesa: number; resultado: number }[];
  despesasPorCategoria: { name: string; value: number; color: string }[];
}

type Period = {
  date: Date;
  startIso: string;
  endIso: string;
  startDate: string;
  endDate: string;
};

type PedidoRow = {
  valor_total: number | null;
};

type ContaPagarRow = {
  id: string;
  valor: number;
  categoria: string | null;
  descricao: string;
  compra_id?: string | null;
};

type CaixaRow = {
  valor: number;
  categoria: string | null;
  descricao: string;
};

const STATUS_RECEITA = ["entregue", "finalizado", "pago_cartao"];

const mesesOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: format(new Date(2025, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
}));

const anosOptions = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));

const toPeriod = (date: Date): Period => ({
  date,
  startIso: startOfMonth(date).toISOString(),
  endIso: endOfMonth(date).toISOString(),
  startDate: format(startOfMonth(date), "yyyy-MM-dd"),
  endDate: format(endOfMonth(date), "yyyy-MM-dd"),
});

const sumBy = <T,>(rows: T[] | null | undefined, pick: (row: T) => number | null | undefined) =>
  (rows || []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);

const isTransferenciaInterna = (categoria?: string | null, descricao?: string | null) => {
  const text = `${categoria || ""} ${descricao || ""}`.toLowerCase();
  return text.includes("depósito banc") || text.includes("deposito banc") || text.includes("transferência caixa") || text.includes("transferencia caixa");
};

const variation = (current: number, previous: number) => {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const normalizeCategory = (value?: string | null) => {
  const label = (value || "Outros").trim() || "Outros";
  return label
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^\w|\s\w/g, (c) => c.toUpperCase());
};

const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export default function AnaliseResultados() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(String(now.getMonth()));
  const [anoSelecionado, setAnoSelecionado] = useState(String(now.getFullYear()));

  useEffect(() => {
    fetchOverview();
  }, [unidadeAtual, mesSelecionado, anoSelecionado]);

  const applyUnidade = <T,>(query: T): T => {
    if (!unidadeAtual?.id) return query;
    return (query as any).eq("unidade_id", unidadeAtual.id);
  };

  const fetchPedidosFaturados = async (period: Period) => {
    const query = applyUnidade(
      supabase
        .from("pedidos")
        .select("valor_total")
        .in("status", STATUS_RECEITA)
        .gte("data_entrega", period.startIso)
        .lte("data_entrega", period.endIso),
    );
    const { data, error: queryError } = await query;
    if (queryError) throw queryError;
    return (data || []) as PedidoRow[];
  };

  const fetchContasPagas = async (period: Period) => {
    const pagasPorPagamento = applyUnidade(
      supabase
        .from("contas_pagar")
        .select("id, valor, categoria, descricao, compra_id")
        .eq("status", "pago")
        .gte("data_pagamento", period.startDate)
        .lte("data_pagamento", period.endDate),
    );

    const pagasSemDataPagamento = applyUnidade(
      supabase
        .from("contas_pagar")
        .select("id, valor, categoria, descricao, compra_id")
        .eq("status", "pago")
        .is("data_pagamento", null)
        .gte("vencimento", period.startDate)
        .lte("vencimento", period.endDate),
    );

    const [{ data: porPagamento, error: erroPagamento }, { data: semPagamento, error: erroVencimento }] =
      await Promise.all([pagasPorPagamento, pagasSemDataPagamento]);

    if (erroPagamento) throw erroPagamento;
    if (erroVencimento) throw erroVencimento;

    const contas = new Map<string, ContaPagarRow>();
    [...(porPagamento || []), ...(semPagamento || [])].forEach((conta) => contas.set(conta.id, conta as ContaPagarRow));
    return Array.from(contas.values()).filter((conta) =>
      isDespesaOperacionalResultado({ categoria: conta.categoria, descricao: conta.descricao, compraId: conta.compra_id })
    );
  };

  const fetchDespesasAvulsasCaixa = async (period: Period) => {
    const query = applyUnidade(
      supabase
        .from("movimentacoes_caixa")
        .select("valor, categoria, descricao")
        .eq("tipo", "saida")
        .neq("status", "rejeitada")
        .is("compra_id", null)
        .is("pedido_id", null)
        .gte("created_at", period.startIso)
        .lte("created_at", period.endIso),
    );
    const { data, error: queryError } = await query;
    if (queryError) throw queryError;
    return ((data || []) as CaixaRow[]).filter((despesa) =>
      isDespesaOperacionalResultado({ categoria: despesa.categoria, descricao: despesa.descricao })
    );
  };

  const buildPeriodData = async (period: Period) => {
    const [pedidos, contasPagas, despesasAvulsas] = await Promise.all([
      fetchPedidosFaturados(period),
      fetchContasPagas(period),
      fetchDespesasAvulsasCaixa(period),
    ]);

    const receita = sumBy(pedidos, (pedido) => pedido.valor_total);
    const despesasContas = sumBy(contasPagas, (conta) => conta.valor);
    const despesasCaixa = sumBy(despesasAvulsas, (despesa) => despesa.valor);
    const despesa = despesasContas + despesasCaixa;

    return {
      period,
      pedidos,
      contasPagas,
      despesasAvulsas,
      receita,
      despesa,
      resultado: receita - despesa,
      despesasContas,
      despesasCaixa,
    };
  };

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const mes = Number(mesSelecionado);
      const ano = Number(anoSelecionado);
      const mesAtualDate = new Date(ano, mes, 1);
      const atual = toPeriod(mesAtualDate);
      const anterior = toPeriod(subMonths(mesAtualDate, 1));

      const [dadosAtual, dadosAnterior] = await Promise.all([
        buildPeriodData(atual),
        buildPeriodData(anterior),
      ]);

      const evolucaoDetalhada = await Promise.all(
        Array.from({ length: 6 }, (_, index) => toPeriod(subMonths(mesAtualDate, 5 - index))).map(buildPeriodData),
      );

      const categoriaMap = new Map<string, number>();
      dadosAtual.contasPagas.forEach((conta) => {
        const categoria = normalizeCategory(conta.categoria || conta.descricao);
        categoriaMap.set(categoria, (categoriaMap.get(categoria) || 0) + Number(conta.valor || 0));
      });
      dadosAtual.despesasAvulsas.forEach((despesa) => {
        const categoria = normalizeCategory(despesa.categoria || despesa.descricao);
        categoriaMap.set(categoria, (categoriaMap.get(categoria) || 0) + Number(despesa.valor || 0));
      });

      const despesasPorCategoria = Array.from(categoriaMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value], index) => ({ name, value, color: chartColor(index) }));

      const receitaMesAtual = dadosAtual.receita;
      const despesasMesAtual = dadosAtual.despesa;
      const resultadoMesAtual = dadosAtual.resultado;
      const totalPedidos = dadosAtual.pedidos.length;

      setOverview({
        receitaMesAtual,
        receitaMesAnterior: dadosAnterior.receita,
        despesasMesAtual,
        despesasMesAnterior: dadosAnterior.despesa,
        resultadoMesAtual,
        resultadoMesAnterior: dadosAnterior.resultado,
        totalPedidos,
        ticketMedio: totalPedidos > 0 ? receitaMesAtual / totalPedidos : 0,
        margemLiquida: receitaMesAtual > 0 ? (resultadoMesAtual / receitaMesAtual) * 100 : 0,
        contasPagas: dadosAtual.contasPagas.length,
        despesasAvulsas: dadosAtual.despesasAvulsas.length,
        evolucao: evolucaoDetalhada.map((item) => ({
          mes: format(item.period.date, "MMM", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
          receita: item.receita,
          despesa: item.despesa,
          resultado: item.resultado,
        })),
        despesasPorCategoria,
      });
    } catch (e) {
      console.error("AnaliseResultados fetch error:", e);
      setError("Nao foi possivel carregar os dados da analise. Tente novamente em instantes.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  const mesLabel = format(
    new Date(Number(anoSelecionado), Number(mesSelecionado), 1),
    "MMMM yyyy",
    { locale: ptBR },
  ).replace(/^\w/, (c) => c.toUpperCase());

  return (
    <MainLayout>
      <Header title="Analise de Resultados" subtitle="Resultado financeiro por competencia operacional" />
      <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-3 sm:p-4 md:p-6">
        <DashboardHero
          variant="dark"
          eyebrow="Gestao Operacional"
          icon={Sparkles}
          title="Analise de Resultados"
          description="Visao executiva de receita, despesas e margem com base em pedidos faturados e despesas efetivamente pagas."
          className="border border-white/10 bg-[linear-gradient(135deg,hsl(222_40%_10%),hsl(211_58%_24%)_48%,hsl(199_84%_36%))] shadow-[0_24px_70px_hsl(222_45%_8%/0.34)] max-sm:p-4"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="h-9 w-[132px] border-white/20 bg-white/15 text-primary-foreground shadow-none backdrop-blur hover:bg-white/20 [&>span]:text-primary-foreground">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {mesesOptions.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value}>
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger className="h-9 w-[92px] border-white/20 bg-white/15 text-primary-foreground shadow-none backdrop-blur hover:bg-white/20 [&>span]:text-primary-foreground">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {anosOptions.map((ano) => (
                    <SelectItem key={ano} value={ano}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/20 bg-white/15 text-primary-foreground hover:bg-white/20">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              {mesLabel}
            </Badge>
            {unidadeAtual?.nome && (
              <Badge className="border-white/20 bg-white/15 text-primary-foreground hover:bg-white/20">
                {unidadeAtual.nome}
              </Badge>
            )}
          </div>
        </DashboardHero>

        {loading ? (
          <PageSectionLoader label="Carregando analise..." className="min-h-48" />
        ) : error ? (
          <Card className="border-destructive/25 bg-destructive/5 shadow-[var(--elev-1)]">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Falha ao carregar indicadores</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : overview && (
          <>
            <div className="space-y-3 sm:hidden">
              <Card className="overflow-hidden border-border/60 bg-[linear-gradient(135deg,hsl(222_38%_12%),hsl(211_55%_22%))] text-primary-foreground shadow-[var(--elev-3)]">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/65">Resultado do periodo</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                        {fmtBRL(overview.resultadoMesAtual)}
                      </p>
                      <p className="mt-0.5 text-xs text-primary-foreground/70">
                        Margem {formatPercent(overview.margemLiquida)} sobre a receita.
                      </p>
                    </div>
                    <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overview.resultadoMesAtual >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                      {overview.resultadoMesAtual >= 0 ? "positivo" : "atencao"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[calc(var(--radius)-4px)] bg-white/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60">Receita</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{fmtBRL(overview.receitaMesAtual)}</p>
                    </div>
                    <div className="rounded-[calc(var(--radius)-4px)] bg-white/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60">Despesas</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{fmtBRL(overview.despesasMesAtual)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-2">
                <Card className="border-border/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pedidos</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{overview.totalPedidos}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ticket</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{fmtBRLcompact(overview.ticketMedio)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caixa</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{overview.despesasAvulsas}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-5">
              <PremiumKpiCard
                label="Receita faturada"
                value={fmtBRL(overview.receitaMesAtual)}
                icon={DollarSign}
                tone="success"
                subtitle="pedidos entregues/finalizados"
                trend={{ value: variation(overview.receitaMesAtual, overview.receitaMesAnterior), label: "vs mes ant." }}
                sparkline={overview.evolucao.map((item) => item.receita)}
              />
              <PremiumKpiCard
                label="Despesas pagas"
                value={fmtBRL(overview.despesasMesAtual)}
                icon={ReceiptText}
                tone="destructive"
                subtitle="contas pagas + caixa lancado"
                trend={{
                  value: variation(overview.despesasMesAtual, overview.despesasMesAnterior),
                  label: "vs mes ant.",
                  isPositive: overview.despesasMesAtual <= overview.despesasMesAnterior,
                }}
                sparkline={overview.evolucao.map((item) => item.despesa)}
              />
              <PremiumKpiCard
                label="Resultado liquido"
                value={fmtBRL(overview.resultadoMesAtual)}
                icon={overview.resultadoMesAtual >= 0 ? TrendingUp : TrendingDown}
                tone={overview.resultadoMesAtual >= 0 ? "primary" : "destructive"}
                subtitle="receita menos despesas"
                trend={{
                  value: variation(overview.resultadoMesAtual, overview.resultadoMesAnterior),
                  label: "vs mes ant.",
                  isPositive: overview.resultadoMesAtual >= overview.resultadoMesAnterior,
                }}
                sparkline={overview.evolucao.map((item) => item.resultado)}
              />
              <PremiumKpiCard
                label="Ticket medio"
                value={fmtBRL(overview.ticketMedio)}
                icon={Target}
                tone="info"
                subtitle={`${overview.totalPedidos} pedidos faturados`}
              />
              <PremiumKpiCard
                label="Margem liquida"
                value={formatPercent(overview.margemLiquida)}
                icon={Percent}
                tone={overview.margemLiquida >= 0 ? "accent" : "destructive"}
                subtitle="resultado sobre receita"
              />
            </div>

            <div className="hidden gap-3 sm:grid sm:grid-cols-3">
              <Card className="border-border/60 shadow-[var(--elev-1)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-success/10 text-success">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base da receita</p>
                    <p className="text-lg font-semibold tabular-nums">{overview.totalPedidos} pedidos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60 shadow-[var(--elev-1)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-primary/10 text-primary">
                    <CircleDollarSign className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contas consideradas</p>
                    <p className="text-lg font-semibold tabular-nums">{overview.contasPagas} pagas</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60 shadow-[var(--elev-1)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-warning/10 text-warning">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caixa lancado</p>
                    <p className="text-lg font-semibold tabular-nums">{overview.despesasAvulsas} lancadas</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:gap-5 xl:grid-cols-5">
              <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)] xl:col-span-3">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-primary" />
                      Evolucao dos ultimos 6 meses
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Receita</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Despesa</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Resultado</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-4 sm:px-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={overview.evolucao} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="analiseReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={CHART_SEMANTIC.success} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="analiseDespesa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_SEMANTIC.destructive} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={CHART_SEMANTIC.destructive} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="mes" tick={chartAxisTick} tickLine={false} axisLine={false} />
                      <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={fmtBRLcompact} width={58} />
                      <Tooltip content={<ChartTooltip formatter={(value) => fmtBRL(value)} />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.45} />
                      <Area
                        type="monotone"
                        dataKey="receita"
                        name="Receita"
                        stroke={CHART_SEMANTIC.success}
                        fill="url(#analiseReceita)"
                        strokeWidth={2.4}
                      />
                      <Area
                        type="monotone"
                        dataKey="despesa"
                        name="Despesa"
                        stroke={CHART_SEMANTIC.destructive}
                        fill="url(#analiseDespesa)"
                        strokeWidth={2.4}
                      />
                      <Line
                        type="monotone"
                        dataKey="resultado"
                        name="Resultado"
                        stroke={CHART_SEMANTIC.primary}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 0, fill: CHART_SEMANTIC.primary }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="min-w-0 border-border/60 shadow-[var(--elev-2)] max-sm:hidden xl:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ReceiptText className="h-4 w-4 text-primary" />
                    Despesas por categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overview.despesasPorCategoria.length === 0 ? (
                    <EmptyState
                      compact
                      icon={FileText}
                      title="Sem despesas no periodo"
                      description="As contas pagas e despesas lancadas no caixa serao agrupadas aqui."
                    />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie
                            data={overview.despesasPorCategoria}
                            cx="50%"
                            cy="50%"
                            innerRadius={54}
                            outerRadius={82}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="hsl(var(--card))"
                            strokeWidth={2}
                          >
                            {overview.despesasPorCategoria.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip formatter={(value) => fmtBRL(value)} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {overview.despesasPorCategoria.slice(0, 6).map((categoria) => (
                          <div key={categoria.name} className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-4px)] bg-muted/35 px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoria.color }} />
                              <span className="truncate text-sm text-muted-foreground">{categoria.name}</span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtBRL(categoria.value)}</span>
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

        <Tabs defaultValue="resultado" className="w-full min-w-0 max-w-full space-y-4 overflow-hidden">
          <TabsList className="grid h-auto w-full min-w-0 grid-cols-3 rounded-[var(--radius)] border border-border/60 bg-card p-1 shadow-[var(--elev-1)] lg:inline-grid lg:w-auto">
            <TabsTrigger value="resultado" className="flex min-w-0 items-center justify-center gap-1 rounded-[calc(var(--radius)-4px)] px-1.5 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:gap-2 sm:px-3 sm:text-sm">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Resultado Operacional</span>
              <span className="sm:hidden">RO</span>
            </TabsTrigger>
            <TabsTrigger value="dre" className="flex min-w-0 items-center justify-center gap-1 rounded-[calc(var(--radius)-4px)] px-1.5 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:gap-2 sm:px-3 sm:text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              <span>DRE</span>
            </TabsTrigger>
            <TabsTrigger value="equilibrio" className="flex min-w-0 items-center justify-center gap-1 rounded-[calc(var(--radius)-4px)] px-1.5 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:gap-2 sm:px-3 sm:text-sm">
              <Calculator className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Ponto de Equilibrio</span>
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
