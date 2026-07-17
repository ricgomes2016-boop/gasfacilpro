import { useEffect, useState } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Wallet, TrendingUp, DollarSign, Target, Calendar,
  CreditCard, Package, BarChart3, CheckCircle, Clock, ArrowUpRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";
import { ptBR } from "date-fns/locale";

interface SemanaGanhos {
  dia: string;
  valor: number;
  entregas: number;
}

export default function EntregadorFinanceiro() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ganhosHoje: 0,
    ganhosSemana: 0,
    ganhosMes: 0,
    entregasHoje: 0,
    metaMensal: 3000,
    mediaEntrega: 0,
    formaPagto: [] as { forma: string; valor: number; qtd: number }[],
  });
  const [graficoSemana, setGraficoSemana] = useState<SemanaGanhos[]>([]);
  const [acertos, setAcertos] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: ent } = await supabase
          .from("entregadores").select("id").eq("user_id", user.id).maybeSingle();
        if (!ent) { setLoading(false); return; }

        const hoje = new Date();
        const hojeStr = hoje.toISOString().split("T")[0];
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioSemana = subDays(hoje, 6);

        const { data: pedidos } = await supabase
          .from("pedidos")
          .select("id, created_at, valor_total, forma_pagamento, status")
          .eq("entregador_id", ent.id)
          .eq("status", "entregue")
          .gte("created_at", inicioSemana.toISOString())
          .order("created_at", { ascending: false });

        const todos = pedidos || [];

        const pedidosHoje = todos.filter(p => p.created_at.startsWith(hojeStr));
        const pedidosMes = todos.filter(p => new Date(p.created_at) >= inicioMes);

        // Gráfico semana
        const diasMap: Record<string, SemanaGanhos> = {};
        for (let i = 6; i >= 0; i--) {
          const d = subDays(hoje, i);
          const key = format(d, "yyyy-MM-dd");
          diasMap[key] = { dia: format(d, "EEE", { locale: ptBR }), valor: 0, entregas: 0 };
        }
        todos.forEach(p => {
          const key = p.created_at.split("T")[0];
          if (diasMap[key]) {
            diasMap[key].valor += p.valor_total || 0;
            diasMap[key].entregas++;
          }
        });
        setGraficoSemana(Object.values(diasMap));

        // Forma de pagamento
        const fpMap: Record<string, { valor: number; qtd: number }> = {};
        pedidosMes.forEach(p => {
          const fp = p.forma_pagamento || "Não informado";
          if (!fpMap[fp]) fpMap[fp] = { valor: 0, qtd: 0 };
          fpMap[fp].valor += p.valor_total || 0;
          fpMap[fp].qtd++;
        });
        const formaPagto = Object.entries(fpMap)
          .map(([forma, v]) => ({ forma, ...v }))
          .sort((a, b) => b.valor - a.valor);

        setAcertos([]);

        const totalHoje = pedidosHoje.reduce((s, p) => s + (p.valor_total || 0), 0);
        const totalSemana = todos.reduce((s, p) => s + (p.valor_total || 0), 0);
        const totalMes = pedidosMes.reduce((s, p) => s + (p.valor_total || 0), 0);

        setStats({
          ganhosHoje: totalHoje,
          ganhosSemana: totalSemana,
          ganhosMes: totalMes,
          entregasHoje: pedidosHoje.length,
          metaMensal: 3000,
          mediaEntrega: pedidosMes.length > 0 ? totalMes / pedidosMes.length : 0,
          formaPagto,
        });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  const progMeta = Math.min(100, (stats.ganhosMes / stats.metaMensal) * 100);

  if (loading) {
    return (
      <EntregadorLayout title="Financeiro">
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Meu Financeiro">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="gradient-primary rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/80 text-sm">Ganhos do Mês</p>
            <Badge className="bg-white/20 text-white border-none text-xs">
              {format(getBrasiliaDate(), "MMMM yyyy", { locale: ptBR })}
            </Badge>
          </div>
          <p className="text-3xl font-bold mb-3">R$ {stats.ganhosMes.toFixed(2)}</p>

          {/* Barra de meta */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/80">
              <span>Meta: R$ {stats.metaMensal.toFixed(0)}</span>
              <span>{Math.round(progMeta)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${progMeta}%` }} />
            </div>
            {progMeta >= 100 && (
              <p className="text-xs text-white/90 font-medium">🎉 Meta atingida!</p>
            )}
          </div>
        </div>

        {/* Cards rápidos */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none shadow-sm bg-success/5 border-success/20">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Hoje</p>
              <p className="text-xl font-bold text-success">R$ {stats.ganhosHoje.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{stats.entregasHoje} entregas</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Esta semana</p>
              <p className="text-xl font-bold">R$ {stats.ganhosSemana.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">média R$ {(stats.ganhosSemana / 7).toFixed(0)}/dia</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Ticket médio</p>
              <p className="text-xl font-bold">R$ {stats.mediaEntrega.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">por entrega</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Faltam para meta</p>
              <p className="text-xl font-bold text-primary">
                R$ {Math.max(0, stats.metaMensal - stats.ganhosMes).toFixed(0)}
              </p>
              <Progress value={progMeta} className="h-1.5 mt-1" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="grafico">
          <TabsList className="w-full">
            <TabsTrigger value="grafico" className="flex-1"><TrendingUp className="h-4 w-4 mr-1" />Evolução</TabsTrigger>
            <TabsTrigger value="pagamento" className="flex-1"><CreditCard className="h-4 w-4 mr-1" />Pagamentos</TabsTrigger>
            <TabsTrigger value="acertos" className="flex-1"><CheckCircle className="h-4 w-4 mr-1" />Acertos</TabsTrigger>
          </TabsList>

          {/* Gráfico semana */}
          <TabsContent value="grafico">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ganhos nos Últimos 7 Dias</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={graficoSemana} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: number) => [`R$ ${val.toFixed(2)}`, "Ganhos"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Por forma de pagamento */}
          <TabsContent value="pagamento">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recebimentos por Forma de Pagamento (mês)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.formaPagto.length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">Sem dados este mês</p>
                )}
                {stats.formaPagto.map(fp => {
                  const total = stats.formaPagto.reduce((s, f) => s + f.valor, 0);
                  return (
                    <div key={fp.forma} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{fp.forma}</span>
                          <Badge variant="outline" className="text-xs">{fp.qtd}x</Badge>
                        </div>
                        <span className="font-bold">R$ {fp.valor.toFixed(2)}</span>
                      </div>
                      <Progress value={total > 0 ? (fp.valor / total) * 100 : 0} className="h-1.5" />
                    </div>
                  );
                })}
                {stats.formaPagto.length > 0 && (
                  <div className="pt-2 border-t flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="text-primary">R$ {stats.formaPagto.reduce((s, f) => s + f.valor, 0).toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico de acertos */}
          <TabsContent value="acertos">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Histórico de Acertos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {acertos.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        a.status === "pago" ? "bg-success/10" : "bg-warning/10"
                      }`}>
                        {a.status === "pago"
                          ? <CheckCircle className="h-4 w-4 text-success" />
                          : <Clock className="h-4 w-4 text-warning" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm capitalize">{a.mes}</p>
                        <Badge variant="outline" className={`text-xs ${
                          a.status === "pago"
                            ? "text-success border-success/30"
                            : "text-warning border-warning/30"
                        }`}>
                          {a.status === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                    </div>
                    <p className="font-bold text-primary">R$ {a.valor.toFixed(2)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EntregadorLayout>
  );
}
