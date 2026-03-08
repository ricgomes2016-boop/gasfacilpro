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

  return (
    <MainLayout>
      <Header title="Dashboard" subtitle="Bem-vindo ao GásPro - Sua revenda de gás" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* ── Hero Gradient Card ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-6 md:p-8 text-white shadow-xl">
          <div className="absolute right-0 top-0 opacity-10">
            <Flame className="h-56 w-56 -mt-8 -mr-8" strokeWidth={0.8} />
          </div>
          <div className="absolute left-1/2 bottom-0 opacity-5">
            <Flame className="h-40 w-40 mb-[-2rem]" strokeWidth={0.6} />
          </div>
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-5 w-5" />
                <span className="text-sm font-medium text-white/80">Gás Fácil</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-0.5">
                {greeting.text}! {greeting.emoji}
              </h1>
              <p className="text-sm text-white/70 capitalize">{todayFormatted}</p>
            </div>
            <VoiceAssistant userName={greeting.text} />
          </div>
        </div>

        {/* Briefing IA do dia */}
        <DailyBriefingWidget />

        {/* Anotações & Lembretes em destaque */}
        <NotesWidget />

        {/* Filtro de período */}
        <div className="flex items-center justify-between flex-wrap gap-3">
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
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
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
          <StatCard
            title="Ticket Médio"
            value={`R$ ${(stats?.ticketMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
            variant="info"
          />
          <StatCard title="Entregas Pendentes" value={stats?.pendentes ?? 0} icon={Truck} variant="warning" />
          <StatCard title="Clientes Ativos" value={stats?.clientesAtivos ?? 0} icon={Users} />
        </div>

        {/* Atalhos rápidos */}
        <QuickActions />

        {/* Gráfico vendas/hora + Meta diária */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChart />
          </div>
          <div className="space-y-4 md:space-y-6">
            <AiInsightsWidget />
            <DailySalesGoal />
            <DeliveryDriverStatus />
          </div>
        </div>

        {/* Vendas recentes */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentSales />
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <StockOverview />
          <DeliveriesMap />
        </div>
      </div>
    </MainLayout>
  );
}
