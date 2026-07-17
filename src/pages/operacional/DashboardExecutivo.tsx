import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DollarSign, Package, Users, Target, Calendar, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getBrasiliaDate } from "@/lib/utils";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { KpiGridSkeleton, ChartCardSkeleton } from "@/components/dashboard/premium/skeletons";
import { chartColor, chartGridProps, chartAxisTick, fmtBRL, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";

export default function DashboardExecutivo() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [faturamento, setFaturamento] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [clientesAtivos, setClientesAtivos] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [vendasSemana, setVendasSemana] = useState<any[]>([]);
  const [produtosVendidos, setProdutosVendidos] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const mesAtual = now.toISOString();

      let pedidosQuery = supabase
        .from("pedidos").select("valor_total, created_at")
        .gte("created_at", mesInicio).lte("created_at", mesAtual)
        .neq("status", "cancelado");
      if (unidadeAtual?.id) pedidosQuery = pedidosQuery.eq("unidade_id", unidadeAtual.id);
      const { data: pedidos } = await pedidosQuery;

      const totalFat = pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;
      setFaturamento(totalFat);
      setTotalVendas(pedidos?.length || 0);
      setTicketMedio(pedidos?.length ? totalFat / pedidos.length : 0);

      let clientesQuery = supabase.from("clientes").select("id", { count: "exact" }).eq("ativo", true);
      if (empresa?.id) clientesQuery = clientesQuery.eq("empresa_id", empresa.id);
      const { count: cliCount } = await clientesQuery;
      setClientesAtivos(cliCount || 0);

      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const semanaData: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const diaInicio = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const diaFim = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        let dq = supabase.from("pedidos").select("valor_total")
          .gte("created_at", diaInicio).lt("created_at", diaFim).neq("status", "cancelado");
        if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);
        const { data: dp } = await dq;
        semanaData.push({
          dia: dias[d.getDay()],
          valor: dp?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0,
        });
      }
      setVendasSemana(semanaData);

      let itensQuery = supabase.from("pedido_itens").select("quantidade, produto:produtos(nome)");
      const { data: itens } = await itensQuery;
      const prodMap: Record<string, number> = {};
      itens?.forEach((item: any) => {
        const nome = item.produto?.nome || "Outros";
        prodMap[nome] = (prodMap[nome] || 0) + item.quantidade;
      });
      const totalQtd = Object.values(prodMap).reduce((s, v) => s + v, 0) || 1;
      const prods = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([nome, qtd]) => ({ nome, valor: Math.round((qtd / totalQtd) * 100) }));
      setProdutosVendidos(prods);
    } catch (e) {
      console.error("Erro ao carregar dashboard executivo:", e);
    } finally {
      setLoading(false);
    }
  };

  const mesAtualLabel = getBrasiliaDate().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const spark = vendasSemana.map((d) => d.valor);
  const metaMensal = 150000;
  const progresso = Math.min((faturamento / metaMensal) * 100, 100);

  return (
    <MainLayout>
      <Header title="Dashboard Executivo" subtitle="Visão geral do negócio" />
      <div className="space-y-6 p-3 sm:p-4 md:p-6">
        <DashboardHero
          eyebrow="Executivo"
          icon={Sparkles}
          title="Visão geral do negócio"
          description={`Indicadores consolidados de ${mesAtualLabel} — receita, volume, clientes e mix de produtos.`}
          actions={
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-primary-foreground/90 backdrop-blur">
              <Calendar className="h-3.5 w-3.5" />
              {mesAtualLabel}
            </div>
          }
        />

        {loading ? (
          <KpiGridSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PremiumKpiCard
              label="Faturamento Mensal" value={fmtBRL(faturamento)} icon={DollarSign} tone="success"
              subtitle="mês corrente" sparkline={spark}
            />
            <PremiumKpiCard
              label="Vendas Realizadas" value={String(totalVendas)} icon={Package} tone="info"
              subtitle="pedidos válidos"
            />
            <PremiumKpiCard
              label="Clientes Ativos" value={String(clientesAtivos)} icon={Users} tone="primary"
              subtitle="base cadastrada"
            />
            <PremiumKpiCard
              label="Ticket Médio" value={fmtBRL(ticketMedio)} icon={Target} tone="accent"
              subtitle="por pedido"
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {loading ? (
            <>
              <ChartCardSkeleton />
              <ChartCardSkeleton />
            </>
          ) : (
            <>
              <Card className="border-border/60 shadow-[var(--elev-2)]">
                <CardHeader>
                  <CardTitle>Vendas da Semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={vendasSemana} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="dia" tick={chartAxisTick} tickLine={false} axisLine={false} />
                      <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={fmtBRLcompact} width={55} />
                      <Tooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                      <Line
                        type="monotone" dataKey="valor" name="Vendas"
                        stroke="hsl(var(--primary))" strokeWidth={2.25}
                        dot={{ fill: "hsl(var(--primary))", r: 3 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-[var(--elev-2)]">
                <CardHeader>
                  <CardTitle>Produtos Mais Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  {produtosVendidos.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={produtosVendidos}
                          cx="50%" cy="50%"
                          labelLine={false}
                          label={({ nome, valor }) => `${nome}: ${valor}%`}
                          outerRadius={95} innerRadius={55}
                          paddingAngle={2}
                          dataKey="valor"
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                        >
                          {produtosVendidos.map((_, i) => (
                            <Cell key={i} fill={chartColor(i)} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      compact icon={Package} title="Sem produtos vendidos"
                      description="Os produtos mais vendidos aparecerão aqui quando houver itens em pedidos."
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card className="border-border/60 shadow-[var(--elev-1)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Progresso da Meta Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Faturamento</span>
                <span className="font-semibold tabular-nums">{fmtBRL(faturamento)} <span className="text-muted-foreground">/ {fmtBRL(metaMensal)}</span></span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-700"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">{progresso.toFixed(1)}% da meta</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
