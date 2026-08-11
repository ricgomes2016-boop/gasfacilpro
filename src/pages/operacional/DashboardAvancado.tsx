import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";
import { TrendingUp, BarChart3, PieChart, Activity, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { KpiCardSkeleton, ChartCardSkeleton } from "@/components/dashboard/premium/skeletons";
import { chartGridProps, chartAxisTick, CHART_SEMANTIC, fmtBRL, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";
import { isDespesaOperacionalResultado } from "@/lib/financeiro/despesasResultado";

export default function DashboardAvancado() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dadosMensais, setDadosMensais] = useState<any[]>([]);
  const [vendasPorHora, setVendasPorHora] = useState<any[]>([]);
  const [metricas, setMetricas] = useState({ faturamento: 0, despesas: 0, lucro: 0, tempoMedio: 0, taxaConclusao: 0, entregasPorEntregador: 0, custoPorEntrega: 0 });

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const dados: any[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const inicio = d.toISOString();
        const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();

        let pq = supabase.from("pedidos").select("valor_total").gte("created_at", inicio).lt("created_at", fim).neq("status", "cancelado");
        if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
        const { data: pedidos } = await pq;

        let dq = supabase.from("movimentacoes_caixa").select("valor, categoria, descricao, compra_id, status").eq("tipo", "saida").gte("created_at", inicio).lt("created_at", fim);
        if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);
        const { data: despesas } = await dq;

        const vendas = pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;
        const desp = despesas
          ?.filter((d: any) => isDespesaOperacionalResultado({ categoria: d.categoria, descricao: d.descricao, compraId: d.compra_id, status: d.status }))
          .reduce((s, d) => s + (d.valor || 0), 0) || 0;
        dados.push({ mes: meses[d.getMonth()], vendas, despesas: desp, lucro: vendas - desp });
      }
      setDadosMensais(dados);

      const totalFat = dados.reduce((s, d) => s + d.vendas, 0);
      const totalDesp = dados.reduce((s, d) => s + d.despesas, 0);
      setMetricas(m => ({ ...m, faturamento: totalFat, despesas: totalDesp, lucro: totalFat - totalDesp }));

      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      let hq = supabase.from("pedidos").select("created_at").gte("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) hq = hq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosHoje } = await hq;

      const horasMap: Record<string, number> = {};
      for (let h = 8; h <= 20; h++) horasMap[`${h.toString().padStart(2, "0")}h`] = 0;
      pedidosHoje?.forEach(p => {
        const hora = new Date(p.created_at).getHours();
        const key = `${hora.toString().padStart(2, "0")}h`;
        if (horasMap[key] !== undefined) horasMap[key]++;
      });
      setVendasPorHora(Object.entries(horasMap).map(([hora, vendas]) => ({ hora, vendas })));

      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let eq = supabase.from("pedidos").select("status, entregador_id").gte("created_at", mesInicio);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosMes } = await eq;

      const entregues = pedidosMes?.filter(p => p.status === "entregue").length || 0;
      const total = pedidosMes?.length || 1;
      const entregadores = new Set(pedidosMes?.map(p => p.entregador_id).filter(Boolean)).size || 1;

      setMetricas(m => ({
        ...m,
        taxaConclusao: (entregues / total) * 100,
        entregasPorEntregador: entregues / entregadores,
        custoPorEntrega: totalDesp > 0 && entregues > 0 ? (totalDesp / 6) / entregues : 0,
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sparkVendas = dadosMensais.map(d => d.vendas);
  const sparkDesp = dadosMensais.map(d => d.despesas);
  const sparkLucro = dadosMensais.map(d => d.lucro);

  return (
    <MainLayout>
      <div className="p-3 sm:p-4 md:p-6 space-y-5 md:space-y-6">
        <DashboardHero
          eyebrow="Analytics"
          icon={LineChart}
          title="Dashboard Avançado"
          description="Análises detalhadas de performance financeira, comercial e operacional dos últimos 6 meses."
        />

        <Tabs defaultValue="financeiro" className="space-y-5">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="operacional">Operacional</TabsTrigger>
          </TabsList>

          <TabsContent value="financeiro" className="space-y-5">
            {loading ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => <KpiCardSkeleton key={i} />)}
                </div>
                <ChartCardSkeleton height={340} />
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <PremiumKpiCard label="Faturamento (6 meses)" value={fmtBRL(metricas.faturamento)} icon={TrendingUp} tone="success" sparkline={sparkVendas} />
                  <PremiumKpiCard label="Despesas (6 meses)" value={fmtBRL(metricas.despesas)} icon={BarChart3} tone="destructive" sparkline={sparkDesp} />
                  <PremiumKpiCard label="Lucro Líquido" value={fmtBRL(metricas.lucro)} icon={PieChart} tone="primary" sparkline={sparkLucro} />
                </div>

                <div className="rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-2)]">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold">Evolução Financeira</h3>
                    <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
                  </div>
                  <ResponsiveContainer width="100%" height={340}>
                    <AreaChart data={dadosMensais} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="advGradVendas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="advGradLucro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_SEMANTIC.info} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_SEMANTIC.info} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="mes" tick={chartAxisTick} axisLine={false} tickLine={false} tickMargin={10} />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickMargin={8} width={58} tickFormatter={fmtBRLcompact} />
                      <Tooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "3 3" }} />
                      <Legend iconType="circle" verticalAlign="top" align="right" height={30} wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="vendas" name="Vendas" stroke={CHART_SEMANTIC.success} strokeWidth={2.5} fill="url(#advGradVendas)" />
                      <Area type="monotone" dataKey="lucro" name="Lucro" stroke={CHART_SEMANTIC.info} strokeWidth={2.5} fill="url(#advGradLucro)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="vendas" className="space-y-5">
            {loading ? <ChartCardSkeleton height={340} /> : (
              <div className="rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-2)]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Vendas por Hora do Dia</h3>
                  <span className="text-xs text-muted-foreground">Hoje</span>
                </div>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={vendasPorHora} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="hora" tick={chartAxisTick} axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickMargin={8} width={36} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v} vendas`} />} cursor={{ fill: "hsl(var(--primary) / 0.08)" }} />
                    <Bar dataKey="vendas" name="Vendas" fill={CHART_SEMANTIC.primary} radius={[8, 8, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="operacional" className="space-y-5">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Activity className="h-4 w-4" /> Métricas Operacionais
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <PremiumKpiCard label="Taxa de Conclusão" value={`${metricas.taxaConclusao.toFixed(1)}%`} icon={TrendingUp} tone="success" />
                  <PremiumKpiCard label="Entregas por Entregador/Mês" value={metricas.entregasPorEntregador.toFixed(1)} icon={Activity} tone="info" />
                  <PremiumKpiCard label="Custo por Entrega" value={fmtBRL(metricas.custoPorEntrega)} icon={BarChart3} tone="warning" />
                  <PremiumKpiCard label="Lucro Médio Mensal" value={fmtBRL(metricas.lucro / 6)} icon={PieChart} tone="primary" />
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
