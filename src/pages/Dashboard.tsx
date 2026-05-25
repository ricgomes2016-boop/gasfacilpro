import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentSales } from "@/components/dashboard/RecentSales";
import { StockOverview } from "@/components/dashboard/StockOverview";
import { DeliveriesMap } from "@/components/dashboard/DeliveriesMap";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { NotesWidget } from "@/components/dashboard/NotesWidget";
import { DeliveryDriverStatus } from "@/components/dashboard/DeliveryDriverStatus";
import { AiInsightsWidget } from "@/components/dashboard/AiInsightsWidget";
import { DailySalesGoal } from "@/components/dashboard/DailySalesGoal";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { DailyBriefingWidget } from "@/components/dashboard/DailyBriefingWidget";
import { GasmaisThemeBanner } from "@/components/dashboard/GasmaisThemeBanner";
import { VoiceAssistant } from "@/components/ai/VoiceAssistant";
import { ShoppingCart, Truck, Users, DollarSign, TrendingUp, Flame } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { subDays, startOfWeek, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { getBrasiliaDate, getBrasiliaStartOfDay, getBrasiliaEndOfDay } from "@/lib/utils";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

type Period = "hoje" | "semana" | "mes";

export default function Dashboard() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [period, setPeriod] = useState<Period>("hoje");
  const today = getBrasiliaDate();

  const getRange = (p: Period) => {
    switch (p) {
      case "semana":
        return { start: startOfWeek(today, { weekStartsOn: 1 }).toISOString(), end: getBrasiliaEndOfDay(today) };
      case "mes":
        return { start: startOfMonth(today).toISOString(), end: getBrasiliaEndOfDay(today) };
      default:
        return { start: getBrasiliaStartOfDay(today), end: getBrasiliaEndOfDay(today) };
    }
  };

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", unidadeAtual?.id, empresa?.id, period],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const { start, end } = getRange(period);

      const baseFilter = (q: any) => {
        if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
        return q;
      };

      const { data: pedidos } = await baseFilter(
        supabase.from("pedidos").select("valor_total, status")
          .gte("created_at", start).lte("created_at", end)
      );

      const valid = (pedidos || []).filter((p: any) => p.status !== "cancelado");
      const vendasPeriodo = valid.reduce((sum: number, p: any) => sum + (Number(p.valor_total) || 0), 0);
      const totalPedidos = pedidos?.length || 0;
      const pendentes = (pedidos || []).filter((p: any) => p.status === "pendente" || p.status === "em_rota").length;
      const ticketMedio = valid.length > 0 ? vendasPeriodo / valid.length : 0;

      let trendVendas: { value: number; isPositive: boolean } | undefined;
      let trendPedidos: { value: number; isPositive: boolean } | undefined;

      if (period === "hoje") {
        const yesterday = subDays(today, 1);
        const { data: pedidosOntem } = await baseFilter(
          supabase.from("pedidos").select("valor_total, status")
            .gte("created_at", getBrasiliaStartOfDay(yesterday))
            .lte("created_at", getBrasiliaEndOfDay(yesterday))
        );

        const validOntem = (pedidosOntem || []).filter((p: any) => p.status !== "cancelado");
        const vendasOntem = validOntem.reduce((sum: number, p: any) => sum + (Number(p.valor_total) || 0), 0);

        if (vendasOntem > 0) {
          const pctVendas = ((vendasPeriodo - vendasOntem) / vendasOntem) * 100;
          trendVendas = { value: Math.round(Math.abs(pctVendas)), isPositive: pctVendas >= 0 };
        }

        const totalOntem = pedidosOntem?.length || 0;
        if (totalOntem > 0) {
          const pctPedidos = ((totalPedidos - totalOntem) / totalOntem) * 100;
          trendPedidos = { value: Math.round(Math.abs(pctPedidos)), isPositive: pctPedidos >= 0 };
        }
      }

      let clientesQuery = supabase
        .from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true);
      if (empresa?.id) clientesQuery = clientesQuery.eq("empresa_id", empresa.id);
      const { count: clientesAtivos } = await clientesQuery;

      return {
        vendasPeriodo,
        totalPedidos,
        pendentes,
        clientesAtivos: clientesAtivos || 0,
        ticketMedio,
        trendVendas,
        trendPedidos,
      };
    },
    refetchInterval: 30000,
  });

  const { data: caixaDiario } = useQuery({
    queryKey: ["dashboard-caixa-hoje", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id && period === "hoje",
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      let q = supabase
        .from("vw_conferencia_caixa")
        .select("total_entradas_caixa, diferenca_calculada")
        .eq("data", hoje)
        .eq("sessao_status", "aberto");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      
      const { data } = await q.maybeSingle();
      return data || { total_entradas_caixa: 0, diferenca_calculada: 0 };
    },
    refetchInterval: 30000,
  });

  const periodLabel = { hoje: "Hoje", semana: "Semana", mes: "Mês" }[period];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: "Bom dia", emoji: "☀️" };
    if (h < 18) return { text: "Boa tarde", emoji: "🌤️" };
    return { text: "Boa noite", emoji: "🌙" };
  };
  const greeting = getGreeting();
  const todayFormatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { themeClass, isGasmaisDashboard } = useDashboardTheme();

  return (
    <MainLayout>
      <Header title="Dashboard" subtitle="Bem-vindo ao GásPro - Sua revenda de gás" />
      <div className={`${themeClass} dashboard-shell`}>
        {/* Banner promocional do tema GásMais (dispensável) */}
        <GasmaisThemeBanner />

        {/* ── Hero Gradient Card ── */}
        <div className="dashboard-hero">
          <div className="absolute right-0 top-0 opacity-10">
            <Flame className="h-56 w-56 -mt-8 -mr-8" strokeWidth={0.8} />
          </div>
          <div className="absolute left-1/2 bottom-0 opacity-5">
            <Flame className="h-40 w-40 mb-[-2rem]" strokeWidth={0.6} />
          </div>
          <div className="relative z-10 flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-5 w-5" />
                <span className="text-sm font-medium text-primary-foreground/80">Gás Fácil</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-0.5 text-primary-foreground">
                {greeting.text}! {greeting.emoji}
              </h1>
              <p className="text-sm text-primary-foreground/70 capitalize line-clamp-2">{todayFormatted}</p>
            </div>
            <VoiceAssistant userName={greeting.text} />
          </div>

          {/* KPIs embutidos no hero (apenas tema GásMais) */}
          {isGasmaisDashboard && (
            <div className="relative z-10 mt-6 grid w-full min-w-0 auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <StatCard
                title={`Vendas ${periodLabel}`}
                value={`R$ ${(stats?.vendasPeriodo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                subtitle={`${stats?.totalPedidos ?? 0} pedidos`}
                onHero
              />
              <StatCard
                title="Pedidos"
                value={stats?.totalPedidos ?? 0}
                icon={ShoppingCart}
                subtitle={periodLabel}
                onHero
              />
              <StatCard
                title="Pendentes"
                value={stats?.pendentes ?? 0}
                icon={Truck}
                subtitle="em aberto"
                onHero
              />
              <StatCard
                title="Clientes Ativos"
                value={stats?.clientesAtivos ?? 0}
                icon={Users}
                subtitle="cadastrados"
                onHero
              />
              <StatCard
                title="Ticket Médio"
                value={`R$ ${(stats?.ticketMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={TrendingUp}
                subtitle="por pedido"
                onHero
              />
              {period === "hoje" && (
                <>
                  <StatCard
                    title="Entradas Caixa"
                    value={`R$ ${(caixaDiario?.total_entradas_caixa ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    subtitle="hoje"
                    onHero
                  />
                  <StatCard
                    title="Diferença Caixa"
                    value={`R$ ${(caixaDiario?.diferenca_calculada ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    icon={Flame}
                    subtitle={(caixaDiario?.diferenca_calculada ?? 0) !== 0 ? "atenção" : "ok"}
                    onHero
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Briefing IA do dia */}
        <DailyBriefingWidget />

        {/* Anotações & Lembretes em destaque */}
        <NotesWidget />

        {/* Filtro de período */}
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Alertas de estoque crítico */}
        <StockAlerts />

        {/* Cards com comparativo e Ticket Médio */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <StatCard
            title={`Vendas ${periodLabel}`}
            value={`R$ ${(stats?.vendasPeriodo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            variant="primary"
            trend={stats?.trendVendas}
          />
          <StatCard
            title="Pedidos"
            value={stats?.totalPedidos ?? 0}
            icon={ShoppingCart}
            trend={stats?.trendPedidos}
          />
          <StatCard title="Pendentes" value={stats?.pendentes ?? 0} icon={Truck} variant="warning" />
          <StatCard title="Clientes Ativos" value={stats?.clientesAtivos ?? 0} icon={Users} />
          <StatCard
            title="Ticket Médio"
            value={`R$ ${(stats?.ticketMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
            variant="info"
          />
          {period === "hoje" && (
            <>
              <StatCard
                title={`Vendas ${periodLabel}`}
                value={`R$ ${(stats?.vendasPeriodo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                variant="primary"
                trend={stats?.trendVendas}
              />
              <StatCard
                title="Pedidos"
                value={stats?.totalPedidos ?? 0}
                icon={ShoppingCart}
                trend={stats?.trendPedidos}
              />
              <StatCard title="Pendentes" value={stats?.pendentes ?? 0} icon={Truck} variant="warning" />
              <StatCard title="Clientes Ativos" value={stats?.clientesAtivos ?? 0} icon={Users} />
            </>
          )}
          {!isGasmaisDashboard && (
            <>
              <StatCard
                title="Ticket Médio"
                value={`R$ ${(stats?.ticketMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={TrendingUp}
                variant="info"
              />
              {period === "hoje" && (
                <>
                  <StatCard
                    title="Entradas Caixa"
                    value={`R$ ${(caixaDiario?.total_entradas_caixa ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    variant="success"
                  />
                  <StatCard
                    title="Diferença Caixa"
                    value={`R$ ${(caixaDiario?.diferenca_calculada ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    icon={Flame}
                    variant={(caixaDiario?.diferenca_calculada ?? 0) !== 0 ? "warning" : "default"}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Atalhos rápidos */}
        <QuickActions />

        {/* Gráfico vendas/hora + Meta diária */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <SalesChart />
          </div>
          <div className="min-w-0 space-y-4 md:space-y-6">
            <AiInsightsWidget />
            <DailySalesGoal />
            <DeliveryDriverStatus />
          </div>
        </div>

        {/* Vendas recentes */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:gap-6">
          <div className="min-w-0">
            <RecentSales />
          </div>
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
          <div className="min-w-0">
            <StockOverview />
          </div>
          <div className="min-w-0">
            <DeliveriesMap />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
