import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatNumber, calcP13Equivalente } from "@/lib/transp-utils";
import { TrendingUp, TrendingDown, Truck, DollarSign, Package, Building2, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function TranspDashboard() {
  const { user } = useAuth();

  const { data: despesas = [] } = useQuery({
    queryKey: ["transp-despesas-dash"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_despesas").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ["transp-abastecimentos-dash"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_abastecimentos").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["transp-entregas-dash"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_entregas").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const mesAtual = new Date().toISOString().slice(0, 7);
  const despesasMes = despesas.filter((d: any) => d.data?.startsWith(mesAtual));
  const abastecimentosMes = abastecimentos.filter((a: any) => a.data?.startsWith(mesAtual));

  const totalGastoMes = despesasMes.reduce((acc: number, d: any) => acc + Number(d.valor || 0), 0);
  const totalTransportado = abastecimentosMes.reduce((acc: number, a: any) => acc + Number(a.p13_equivalente || 0), 0);
  const custoMedio = totalTransportado > 0 ? totalGastoMes / totalTransportado : 0;

  const totalEntregas = entregas.filter((e: any) => e.data?.startsWith(mesAtual)).length;

  // Aggregate by month for chart
  const monthlyData = despesas.reduce((acc: any, d: any) => {
    const month = d.data?.slice(0, 7);
    if (!month) return acc;
    if (!acc[month]) acc[month] = { mes: month, despesas: 0 };
    acc[month].despesas += Number(d.valor || 0);
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(monthlyData).sort((a: any, b: any) => a.mes.localeCompare(b.mes)).slice(-6);

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Transportadora</h1>
          <p className="text-muted-foreground text-sm">Visão geral dos custos logísticos</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Custo Médio / P13</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(custoMedio)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Gasto no Mês</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalGastoMes)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Transportado (P13 eq.)</p>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(totalTransportado, 0)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-accent/40 flex items-center justify-center">
                  <Package className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Entregas no Mês</p>
                  <p className="text-2xl font-bold text-foreground">{totalEntregas}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-secondary/60 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Evolução de Custos Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="despesas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de despesas para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        {custoMedio > 0 && (
          <Card className="border-border/40 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Alertas Inteligentes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Custo médio por P13 equivalente: {formatCurrency(custoMedio)} · 
                    {totalTransportado > 0 ? ` ${formatNumber(totalTransportado, 0)} unidades transportadas` : " Nenhuma transferência registrada"} · 
                    Acesse a IA Analista para sugestões detalhadas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TransportadoraLayout>
  );
}
