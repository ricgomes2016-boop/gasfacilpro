import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Target, Award, Medal, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function Gamificacao() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const mesRef = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      let rq = supabase.from("gamificacao_ranking").select("*, entregadores(nome)").eq("mes_referencia", mesRef).order("pontos", { ascending: false });
      if (unidadeAtual?.id) rq = rq.eq("unidade_id", unidadeAtual.id);
      const { data } = await rq;

      if (data && data.length > 0) {
        setRanking(data.map((r, i) => ({
          posicao: i + 1,
          nome: (r.entregadores as any)?.nome || "Desconhecido",
          pontos: r.pontos,
          entregas: r.entregas_realizadas,
          avaliacao: Number(r.avaliacao_media).toFixed(1),
          conquistas: r.conquistas_desbloqueadas,
        })));
      } else {
        // Fallback: calcular do número de entregas
        const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        let eq = supabase.from("pedidos").select("entregador_id, entregadores(nome)").eq("status", "entregue").gte("created_at", mesInicio);
        if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
        const { data: entregas } = await eq;

        const map: Record<string, { nome: string; entregas: number }> = {};
        entregas?.forEach((e: any) => {
          if (e.entregador_id) {
            if (!map[e.entregador_id]) map[e.entregador_id] = { nome: e.entregadores?.nome || "Desconhecido", entregas: 0 };
            map[e.entregador_id].entregas++;
          }
        });

        const sorted = Object.values(map).sort((a, b) => b.entregas - a.entregas);
        setRanking(sorted.map((r, i) => ({
          posicao: i + 1,
          nome: r.nome,
          pontos: r.entregas * 10,
          entregas: r.entregas,
          avaliacao: "-",
          conquistas: 0,
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Gamificação" subtitle="Ranking e conquistas dos motoristas" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  const totalPontos = ranking.reduce((s, r) => s + r.pontos, 0);
  const totalConquistas = ranking.reduce((s, r) => s + r.conquistas, 0);

  return (
    <MainLayout>
      <Header title="Gamificação" subtitle="Ranking e conquistas dos motoristas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Líder do Mês</CardTitle><Trophy className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{ranking[0]?.nome || "-"}</div><p className="text-xs text-muted-foreground">{ranking[0]?.pontos || 0} pontos</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total de Pontos</CardTitle><Star className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{totalPontos.toLocaleString("pt-BR")}</div><p className="text-xs text-muted-foreground">Distribuídos este mês</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Participantes</CardTitle><Target className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{ranking.length}</div><p className="text-xs text-muted-foreground">No ranking</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Conquistas</CardTitle><Award className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-purple-600">{totalConquistas}</div><p className="text-xs text-muted-foreground">Desbloqueadas total</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /><CardTitle>Ranking do Mês</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ranking.length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum dado de ranking disponível</p>}
              {ranking.map((m) => (
                <div key={m.posicao} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg" style={{
                    background: m.posicao === 1 ? 'linear-gradient(135deg, #ffd700, #ffb700)' :
                                m.posicao === 2 ? 'linear-gradient(135deg, #c0c0c0, #a0a0a0)' :
                                m.posicao === 3 ? 'linear-gradient(135deg, #cd7f32, #b87333)' : 'hsl(var(--muted))',
                    color: m.posicao <= 3 ? 'white' : 'inherit'
                  }}>{m.posicao}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.nome}</span>
                      <span className="font-bold text-primary">{m.pontos} pts</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>{m.entregas} entregas</span>
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{m.avaliacao}</span>
                      <span className="flex items-center gap-1"><Medal className="h-3 w-3" />{m.conquistas}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
