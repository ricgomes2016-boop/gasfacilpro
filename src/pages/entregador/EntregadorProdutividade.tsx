import { useEffect, useState, useMemo } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, Package, Clock, MapPin, Zap, Target, Navigation,
  BarChart3, CheckCircle, Timer, Star, ArrowUp, ArrowDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DiaStats {
  dia: string;
  entregas: number;
  valor: number;
}

export default function EntregadorProdutividade() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    entregasHoje: 0,
    entregasSemana: 0,
    entregasMes: 0,
    valorHoje: 0,
    valorSemana: 0,
    tempoMedioMin: 0,
    metaDiaria: 15,
    metaMensal: 200,
    bairroTop: "",
  });
  const [graficoSemana, setGraficoSemana] = useState<DiaStats[]>([]);
  const [porBairro, setPorBairro] = useState<{ bairro: string; qtd: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: ent } = await supabase
          .from("entregadores").select("id").eq("user_id", user.id).maybeSingle();
        if (!ent) { setLoading(false); return; }

        const hoje = getBrasiliaDate();
        const hojeStr = getBrasiliaDateString();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 6);
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        const { data: pedidos } = await supabase
          .from("pedidos")
          .select("id, created_at, valor_total, clientes:cliente_id(bairro), status")
          .eq("entregador_id", ent.id)
          .eq("status", "entregue")
          .gte("created_at", inicioSemana.toISOString())
          .order("created_at", { ascending: false });

        const todos = pedidos || [];
        const pedidosHoje = todos.filter(p => p.created_at.startsWith(hojeStr));
        const pedidosMes = todos.filter(p => new Date(p.created_at) >= inicioMes);

        // Gráfico por dia da semana
        const diasMap: Record<string, { entregas: number; valor: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(hoje);
          d.setDate(hoje.getDate() - i);
          const key = d.toISOString().split("T")[0];
          diasMap[key] = { entregas: 0, valor: 0 };
        }
        todos.forEach(p => {
          const key = p.created_at.split("T")[0];
          if (diasMap[key]) {
            diasMap[key].entregas++;
            diasMap[key].valor += p.valor_total || 0;
          }
        });

        const diasNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const grafico = Object.entries(diasMap).map(([key, val]) => ({
          dia: diasNomes[new Date(key + "T12:00:00").getDay()],
          entregas: val.entregas,
          valor: val.valor,
        }));
        setGraficoSemana(grafico);

        // Bairros
        const bairroMap: Record<string, number> = {};
        todos.forEach((p: any) => {
          const b = p.clientes?.bairro || "Outros";
          bairroMap[b] = (bairroMap[b] || 0) + 1;
        });
        const bairrosSorted = Object.entries(bairroMap)
          .map(([bairro, qtd]) => ({ bairro, qtd }))
          .sort((a, b) => b.qtd - a.qtd);
        setPorBairro(bairrosSorted.slice(0, 5));

        setStats({
          entregasHoje: pedidosHoje.length,
          entregasSemana: todos.length,
          entregasMes: pedidosMes.length,
          valorHoje: pedidosHoje.reduce((s, p) => s + (p.valor_total || 0), 0),
          valorSemana: todos.reduce((s, p) => s + (p.valor_total || 0), 0),
          tempoMedioMin: 28, // estimativa
          metaDiaria: 15,
          metaMensal: 200,
          bairroTop: bairrosSorted[0]?.bairro || "-",
        });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetch();
  }, [user]);

  const progDiario = Math.min(100, (stats.entregasHoje / stats.metaDiaria) * 100);
  const progMensal = Math.min(100, (stats.entregasMes / stats.metaMensal) * 100);

  if (loading) {
    return (
      <EntregadorLayout title="Produtividade">
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Produtividade">
      <div className="p-4 space-y-4">

        {/* Header gradient */}
        <div className="gradient-primary rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/80 text-sm">Desempenho de Hoje</p>
              <h1 className="text-3xl font-bold">{stats.entregasHoje}</h1>
              <p className="text-white/70 text-sm">entregas realizadas</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="h-8 w-8" />
              </div>
              <p className="text-xs text-white/70 mt-1">R$ {stats.valorHoje.toFixed(0)}</p>
            </div>
          </div>

          {/* Meta diária */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/80">
              <span>Meta diária: {stats.entregasHoje}/{stats.metaDiaria}</span>
              <span>{Math.round(progDiario)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progDiario}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Esta semana</p>
              </div>
              <p className="text-2xl font-bold">{stats.entregasSemana}</p>
              <p className="text-xs text-muted-foreground">R$ {stats.valorSemana.toFixed(0)}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Tempo médio</p>
              </div>
              <p className="text-2xl font-bold">{stats.tempoMedioMin}min</p>
              <p className="text-xs text-muted-foreground">por entrega</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Meta mensal</p>
              </div>
              <p className="text-2xl font-bold">{stats.entregasMes}</p>
              <Progress value={progMensal} className="h-1.5 mt-1" />
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Bairro top</p>
              </div>
              <p className="text-lg font-bold truncate">{stats.bairroTop}</p>
              <p className="text-xs text-muted-foreground">mais entregas</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico semanal */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Entregas nos Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={graficoSemana} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number) => [val, "Entregas"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="entregas" radius={[4, 4, 0, 0]}>
                  {graficoSemana.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === graficoSemana.length - 1
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.4)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Bairros */}
        {porBairro.length > 0 && (
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Entregas por Bairro (semana)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {porBairro.map((b, i) => {
                const max = porBairro[0].qtd;
                return (
                  <div key={b.bairro} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Star className="h-3 w-3 text-warning" />}
                        <span className="font-medium">{b.bairro}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{b.qtd}</Badge>
                    </div>
                    <Progress value={(b.qtd / max) * 100} className="h-1.5" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Dicas de produtividade */}
        <Card className="border-none shadow-md bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Dica de Produtividade</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.entregasHoje >= stats.metaDiaria
                    ? "🎉 Meta diária atingida! Continue assim para manter o ranking!"
                    : `Faltam ${stats.metaDiaria - stats.entregasHoje} entregas para a meta do dia. Você consegue!`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </EntregadorLayout>
  );
}
