import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { TrendingUp, BarChart3, PieChart, Activity, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

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

      // Últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const inicio = d.toISOString();
        const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();

        let pq = supabase.from("pedidos").select("valor_total").gte("created_at", inicio).lt("created_at", fim).neq("status", "cancelado");
        if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
        const { data: pedidos } = await pq;

        let dq = supabase.from("movimentacoes_caixa").select("valor").eq("tipo", "saida").gte("created_at", inicio).lt("created_at", fim);
        if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);
        const { data: despesas } = await dq;

        const vendas = pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;
        const desp = despesas?.reduce((s, d) => s + (d.valor || 0), 0) || 0;
        dados.push({ mes: meses[d.getMonth()], vendas, despesas: desp, lucro: vendas - desp });
      }
      setDadosMensais(dados);

      const totalFat = dados.reduce((s, d) => s + d.vendas, 0);
      const totalDesp = dados.reduce((s, d) => s + d.despesas, 0);
      setMetricas(m => ({ ...m, faturamento: totalFat, despesas: totalDesp, lucro: totalFat - totalDesp }));

      // Vendas por hora (hoje)
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

      // Métricas operacionais
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

  if (loading) {
    return (
      <MainLayout>
        <Header title="Dashboard Avançado" subtitle="Análises detalhadas e métricas avançadas" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Dashboard Avançado" subtitle="Análises detalhadas e métricas avançadas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        <Tabs defaultValue="financeiro" className="space-y-6">
          <TabsList>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="operacional">Operacional</TabsTrigger>
          </TabsList>

          <TabsContent value="financeiro" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-500/10"><TrendingUp className="h-6 w-6 text-green-500" /></div>
                    <div>
                      <p className="text-2xl font-bold">R$ {(metricas.faturamento / 1000).toFixed(1)}k</p>
                      <p className="text-sm text-muted-foreground">Faturamento (6 meses)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-destructive/10"><BarChart3 className="h-6 w-6 text-destructive" /></div>
                    <div>
                      <p className="text-2xl font-bold">R$ {(metricas.despesas / 1000).toFixed(1)}k</p>
                      <p className="text-sm text-muted-foreground">Despesas (6 meses)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10"><PieChart className="h-6 w-6 text-primary" /></div>
                    <div>
                      <p className="text-2xl font-bold">R$ {(metricas.lucro / 1000).toFixed(1)}k</p>
                      <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Evolução Financeira</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={dadosMensais}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                    <Area type="monotone" dataKey="vendas" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Vendas" />
                    <Area type="monotone" dataKey="lucro" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} name="Lucro" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendas" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Vendas por Hora do Dia (Hoje)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={vendasPorHora}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hora" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operacional" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Métricas Operacionais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Taxa de Conclusão</p>
                    <p className="text-2xl font-bold">{metricas.taxaConclusao.toFixed(1)}%</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Entregas por Entregador/Mês</p>
                    <p className="text-2xl font-bold">{metricas.entregasPorEntregador.toFixed(1)}</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Custo por Entrega</p>
                    <p className="text-2xl font-bold">R$ {metricas.custoPorEntrega.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Lucro Médio Mensal</p>
                    <p className="text-2xl font-bold">R$ {(metricas.lucro / 6).toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
