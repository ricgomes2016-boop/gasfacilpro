import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { TrendingUp, BarChart3, PieChart, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function AvancadoContent() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dadosMensais, setDadosMensais] = useState<any[]>([]);
  const [vendasPorHora, setVendasPorHora] = useState<any[]>([]);
  const [metricas, setMetricas] = useState({ faturamento: 0, despesas: 0, lucro: 0, taxaConclusao: 0, entregasPorEntregador: 0, custoPorEntrega: 0 });

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

      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      let hq = supabase.from("pedidos").select("created_at").gte("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) hq = hq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosHoje } = await hq;
      const horasMap: Record<string, number> = {};
      for (let h = 8; h <= 20; h++) horasMap[`${h.toString().padStart(2, "0")}h`] = 0;
      pedidosHoje?.forEach(p => { const h = new Date(p.created_at).getHours(); const k = `${h.toString().padStart(2, "0")}h`; if (horasMap[k] !== undefined) horasMap[k]++; });
      setVendasPorHora(Object.entries(horasMap).map(([hora, vendas]) => ({ hora, vendas })));

      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let eq = supabase.from("pedidos").select("status, entregador_id").gte("created_at", mesInicio);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosMes } = await eq;
      const entregues = pedidosMes?.filter(p => p.status === "entregue").length || 0;
      const total = pedidosMes?.length || 1;
      const entregadores = new Set(pedidosMes?.map(p => p.entregador_id).filter(Boolean)).size || 1;
      setMetricas({ faturamento: totalFat, despesas: totalDesp, lucro: totalFat - totalDesp, taxaConclusao: (entregues / total) * 100, entregasPorEntregador: entregues / entregadores, custoPorEntrega: totalDesp > 0 && entregues > 0 ? (totalDesp / 6) / entregues : 0 });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <PageSectionLoader label="Carregando análise avançada..." />;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="financeiro" className="space-y-6">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-3/10"><TrendingUp className="h-6 w-6 text-chart-3" /></div><div><p className="text-2xl font-bold">R$ {(metricas.faturamento / 1000).toFixed(1)}k</p><p className="text-sm text-muted-foreground">Faturamento (6 meses)</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-destructive/10"><BarChart3 className="h-6 w-6 text-destructive" /></div><div><p className="text-2xl font-bold">R$ {(metricas.despesas / 1000).toFixed(1)}k</p><p className="text-sm text-muted-foreground">Despesas (6 meses)</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><PieChart className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">R$ {(metricas.lucro / 1000).toFixed(1)}k</p><p className="text-sm text-muted-foreground">Lucro Líquido</p></div></div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Evolução Financeira</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={dadosMensais} margin={{ top: 14, right: 20, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="vendasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="lucroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} width={58} tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
                    contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border) / 0.55)", boxShadow: "0 18px 45px hsl(var(--foreground) / 0.10)" }}
                    formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`}
                  />
                  <Legend iconType="circle" verticalAlign="top" align="right" height={32} />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--success))" strokeWidth={3} fill="url(#vendasGradient)" name="Vendas" />
                  <Area type="monotone" dataKey="lucro" stroke="hsl(var(--info))" strokeWidth={3} fill="url(#lucroGradient)" name="Lucro" />
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
                <BarChart data={vendasPorHora} margin={{ top: 14, right: 18, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="hora" axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} width={36} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                    contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border) / 0.55)", boxShadow: "0 18px 45px hsl(var(--foreground) / 0.10)" }}
                    formatter={(value) => [value, "Vendas"]}
                  />
                  <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operacional" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Métricas Operacionais</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border"><p className="text-sm text-muted-foreground">Taxa de Conclusão</p><p className="text-2xl font-bold">{metricas.taxaConclusao.toFixed(1)}%</p></div>
                <div className="p-4 rounded-lg border"><p className="text-sm text-muted-foreground">Entregas por Entregador/Mês</p><p className="text-2xl font-bold">{metricas.entregasPorEntregador.toFixed(1)}</p></div>
                <div className="p-4 rounded-lg border"><p className="text-sm text-muted-foreground">Custo por Entrega</p><p className="text-2xl font-bold">R$ {metricas.custoPorEntrega.toFixed(2)}</p></div>
                <div className="p-4 rounded-lg border"><p className="text-sm text-muted-foreground">Lucro Médio Mensal</p><p className="text-2xl font-bold">R$ {(metricas.lucro / 6).toFixed(0)}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
