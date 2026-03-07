import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Trophy, Star, Medal, Crown, Flame, Package, Target, Users,
  Loader2, Zap, TrendingUp, CheckCircle, Award, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EntregadorRanking {
  id: string;
  nome: string;
  entregasTotal: number;
  entregasMes: number;
  pontos: number;
  nivel: string;
  conquistas: number;
  posicao: number;
}

const NIVEIS = [
  { nome: "Bronze", min: 0, max: 499, cor: "text-amber-600", bg: "bg-amber-500/10", icon: Medal },
  { nome: "Prata", min: 500, max: 999, cor: "text-gray-500", bg: "bg-gray-400/10", icon: Star },
  { nome: "Ouro", min: 1000, max: 2499, cor: "text-yellow-500", bg: "bg-yellow-500/10", icon: Trophy },
  { nome: "Platina", min: 2500, max: 4999, cor: "text-blue-500", bg: "bg-blue-500/10", icon: Crown },
  { nome: "Diamante", min: 5000, max: Infinity, cor: "text-purple-500", bg: "bg-purple-500/10", icon: Zap },
];

const getNivel = (pontos: number) => NIVEIS.find(n => pontos >= n.min && pontos <= n.max) || NIVEIS[0];

export default function GamificacaoEntregadores() {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<EntregadorRanking[]>([]);
  const [stats, setStats] = useState({ totalEntregadores: 0, entregasMes: 0, mediaPontos: 0 });
  const [conquistas, setConquistas] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        let entQ = supabase.from("entregadores").select("id, nome").eq("ativo", true);
        if (unidadeAtual?.id) entQ = entQ.eq("unidade_id", unidadeAtual.id);

        let pedQ = supabase.from("pedidos").select("entregador_id").eq("status", "entregue").gte("created_at", mesInicio);
        if (unidadeAtual?.id) pedQ = pedQ.eq("unidade_id", unidadeAtual.id);

        const [{ data: entregadores }, { data: pedidosMes }, { data: allConquistas }] = await Promise.all([
          entQ,
          pedQ,
          supabase.from("conquistas").select("*").order("meta_valor"),
        ]);

        // Total de entregas por entregador este mês
        const entregasPorEntregador: Record<string, number> = {};
        (pedidosMes || []).forEach(p => {
          if (p.entregador_id) {
            entregasPorEntregador[p.entregador_id] = (entregasPorEntregador[p.entregador_id] || 0) + 1;
          }
        });

        // Total histórico
        const { data: pedidosTotal } = await supabase
          .from("pedidos")
          .select("entregador_id")
          .eq("status", "entregue");

        const entregasTotal: Record<string, number> = {};
        (pedidosTotal || []).forEach(p => {
          if (p.entregador_id) {
            entregasTotal[p.entregador_id] = (entregasTotal[p.entregador_id] || 0) + 1;
          }
        });

        // Conquistas desbloqueadas por entregador
        const { data: desbloqueadas } = await supabase
          .from("entregador_conquistas")
          .select("entregador_id");

        const conquistasPorEntregador: Record<string, number> = {};
        (desbloqueadas || []).forEach(d => {
          conquistasPorEntregador[d.entregador_id] = (conquistasPorEntregador[d.entregador_id] || 0) + 1;
        });

        const rankingData: EntregadorRanking[] = (entregadores || []).map(e => {
          const totalEnt = entregasTotal[e.id] || 0;
          const mesEnt = entregasPorEntregador[e.id] || 0;
          const pontos = totalEnt * 10 + mesEnt * 5;
          const nivel = getNivel(pontos);
          return {
            id: e.id,
            nome: e.nome,
            entregasTotal: totalEnt,
            entregasMes: mesEnt,
            pontos,
            nivel: nivel.nome,
            conquistas: conquistasPorEntregador[e.id] || 0,
            posicao: 0,
          };
        }).sort((a, b) => b.pontos - a.pontos)
          .map((e, i) => ({ ...e, posicao: i + 1 }));

        setRanking(rankingData);
        setConquistas(allConquistas || []);
        setStats({
          totalEntregadores: rankingData.length,
          entregasMes: Object.values(entregasPorEntregador).reduce((s, v) => s + v, 0),
          mediaPontos: rankingData.length > 0
            ? Math.round(rankingData.reduce((s, r) => s + r.pontos, 0) / rankingData.length)
            : 0,
        });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Gamificação" subtitle="Ranking e conquistas dos entregadores" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  const top3 = ranking.slice(0, 3);
  const medalhas = [
    { pos: "1º", cor: "bg-yellow-500", text: "text-yellow-900" },
    { pos: "2º", cor: "bg-gray-400", text: "text-gray-900" },
    { pos: "3º", cor: "bg-amber-600", text: "text-amber-100" },
  ];

  return (
    <MainLayout>
      <Header title="Gamificação de Entregadores" subtitle="Ranking, pontos, conquistas e níveis" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">{stats.totalEntregadores}</p><p className="text-xs text-muted-foreground">Entregadores Ativos</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10"><Package className="h-5 w-5 text-green-500" /></div>
                <div><p className="text-2xl font-bold">{stats.entregasMes}</p><p className="text-xs text-muted-foreground">Entregas no Mês</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><Star className="h-5 w-5 text-yellow-500" /></div>
                <div><p className="text-2xl font-bold">{stats.mediaPontos}</p><p className="text-xs text-muted-foreground">Pontos Médios</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pódio Top 3 */}
        {top3.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Pódio do Mês</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-center gap-4">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((e, i) => {
                  const idx = i === 0 ? 1 : i === 1 ? 0 : 2;
                  const altura = idx === 0 ? "h-28" : "h-20";
                  const medal = medalhas[idx];
                  const nivel = getNivel(e.pontos);
                  return (
                    <div key={e.id} className="flex flex-col items-center gap-2">
                      <div className={`h-12 w-12 rounded-full ${nivel.bg} ${nivel.cor} flex items-center justify-center`}>
                        <nivel.icon className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-sm text-center max-w-[80px] truncate">{e.nome}</p>
                      <p className="text-xs text-muted-foreground">{e.pontos}pts</p>
                      <div className={`${altura} w-20 ${medal.cor} rounded-t-xl flex items-center justify-center`}>
                        <span className={`text-xl font-bold ${medal.text}`}>{medal.pos}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="ranking">
          <TabsList>
            <TabsTrigger value="ranking"><BarChart3 className="h-4 w-4 mr-1.5" />Ranking Completo</TabsTrigger>
            <TabsTrigger value="niveis"><Zap className="h-4 w-4 mr-1.5" />Níveis</TabsTrigger>
            <TabsTrigger value="conquistas"><Award className="h-4 w-4 mr-1.5" />Conquistas</TabsTrigger>
          </TabsList>

          {/* Ranking */}
          <TabsContent value="ranking">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Entregador</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Entregas/Mês</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Conquistas</TableHead>
                      <TableHead>Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map(e => {
                      const nivel = getNivel(e.pontos);
                      const NivelIcon = nivel.icon;
                      return (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              e.posicao === 1 ? "bg-yellow-500 text-white"
                                : e.posicao === 2 ? "bg-gray-400 text-white"
                                : e.posicao === 3 ? "bg-amber-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {e.posicao}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${nivel.cor} ${nivel.bg} border-current`}>
                              <NivelIcon className="h-3 w-3 mr-1" />
                              {nivel.nome}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{e.entregasMes}</span>
                              {e.entregasMes > 0 && <Flame className="h-3 w-3 text-orange-500" />}
                            </div>
                          </TableCell>
                          <TableCell>{e.entregasTotal}</TableCell>
                          <TableCell>
                            <Badge variant="outline"><Award className="h-3 w-3 mr-1" />{e.conquistas}</Badge>
                          </TableCell>
                          <TableCell className="font-bold text-primary">{e.pontos}</TableCell>
                        </TableRow>
                      );
                    })}
                    {ranking.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum entregador encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Níveis */}
          <TabsContent value="niveis">
            <div className="grid md:grid-cols-2 gap-4">
              {NIVEIS.map(nivel => {
                const NivelIcon = nivel.icon;
                const entregadoresNivel = ranking.filter(e => getNivel(e.pontos).nome === nivel.nome).length;
                return (
                  <Card key={nivel.nome}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-14 w-14 rounded-2xl ${nivel.bg} flex items-center justify-center`}>
                          <NivelIcon className={`h-7 w-7 ${nivel.cor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`font-bold text-lg ${nivel.cor}`}>{nivel.nome}</p>
                            <Badge variant="outline">{entregadoresNivel} entregadores</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {nivel.min === 0 ? "Início" : `${nivel.min.toLocaleString()}`} – {nivel.max === Infinity ? "∞" : nivel.max.toLocaleString()} pontos
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            10 pts/entrega histórica · 5 pts/entrega no mês
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Conquistas */}
          <TabsContent value="conquistas">
            <div className="grid md:grid-cols-2 gap-4">
              {conquistas.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{c.nome}</p>
                          <Badge variant="outline" className="text-xs">+{c.pontos}pts</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.descricao}</p>
                        <p className="text-xs text-primary mt-1">Meta: {c.meta_valor} {c.tipo === "entregas" ? "entregas" : c.tipo}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {conquistas.length === 0 && (
                <Card className="md:col-span-2">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhuma conquista cadastrada ainda
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
