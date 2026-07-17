import { useEffect, useState } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy, Package, Zap, Flame, Crown, Calendar, Star, Clock, Lock, CheckCircle, Medal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, React.ElementType> = {
  package: Package, zap: Zap, flame: Flame, crown: Crown,
  calendar: Calendar, star: Star, clock: Clock, trophy: Trophy, medal: Medal,
};

interface Conquista {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  meta_valor: number;
  tipo: string;
  pontos: number;
  desbloqueada: boolean;
  progresso: number;
}

interface RankingItem {
  posicao: number;
  nome: string;
  entregas: number;
  pontos: number;
  isMe: boolean;
}

export default function EntregadorConquistas() {
  const { user } = useAuth();
  const [conquistas, setConquistas] = useState<Conquista[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [totalPontos, setTotalPontos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      try {
        // Get entregador
        const { data: ent } = await supabase
          .from("entregadores")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!ent) { setLoading(false); return; }
        setEntregadorId(ent.id);

        // Get total deliveries for this driver
        const { count: totalEntregas } = await supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("entregador_id", ent.id)
          .eq("status", "entregue");

        // Get all conquistas + unlocked ones
        const [{ data: allConquistas }, { data: unlocked }] = await Promise.all([
          supabase.from("conquistas").select("*").order("meta_valor"),
          supabase.from("entregador_conquistas").select("conquista_id").eq("entregador_id", ent.id),
        ]);

        const unlockedIds = new Set((unlocked || []).map((u: any) => u.conquista_id));
        const entregasCount = totalEntregas || 0;

        const mapped: Conquista[] = (allConquistas || []).map((c: any) => {
          const desbloqueada = unlockedIds.has(c.id);
          let progresso = 0;
          if (c.tipo === "entregas") {
            progresso = Math.min(100, (entregasCount / c.meta_valor) * 100);
          }
          return {
            ...c,
            desbloqueada,
            progresso: desbloqueada ? 100 : progresso,
          };
        });

        setConquistas(mapped);
        setTotalPontos(
          mapped.filter((c) => c.desbloqueada).reduce((sum, c) => sum + c.pontos, 0)
        );

        // Auto-unlock conquistas
        for (const c of mapped) {
          if (!c.desbloqueada && c.progresso >= 100) {
            await supabase.from("entregador_conquistas").insert({
              entregador_id: ent.id,
              conquista_id: c.id,
            });
            c.desbloqueada = true;
          }
        }

        // Build ranking from deliveries this month
        const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: entregas } = await supabase
          .from("pedidos")
          .select("entregador_id, entregadores(nome)")
          .eq("status", "entregue")
          .gte("created_at", mesInicio);

        const rankMap: Record<string, { nome: string; entregas: number }> = {};
        entregas?.forEach((e: any) => {
          if (e.entregador_id) {
            if (!rankMap[e.entregador_id])
              rankMap[e.entregador_id] = { nome: e.entregadores?.nome || "?", entregas: 0 };
            rankMap[e.entregador_id].entregas++;
          }
        });

        const sorted = Object.entries(rankMap)
          .sort(([, a], [, b]) => b.entregas - a.entregas)
          .map(([id, r], i) => ({
            posicao: i + 1,
            nome: r.nome,
            entregas: r.entregas,
            pontos: r.entregas * 10,
            isMe: id === ent.id,
          }));

        setRanking(sorted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <EntregadorLayout title="Conquistas">
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </EntregadorLayout>
    );
  }

  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;

  return (
    <EntregadorLayout title="Conquistas">
      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="gradient-primary rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Seus Pontos</p>
              <h1 className="text-3xl font-bold">{totalPontos}</h1>
              <p className="text-white/70 text-xs mt-1">
                {desbloqueadas}/{conquistas.length} conquistas
              </p>
            </div>
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              <Trophy className="h-8 w-8" />
            </div>
          </div>
        </div>

        {/* Conquistas */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Medal className="h-5 w-5 text-primary" />
              Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conquistas.map((c) => {
              const Icon = iconMap[c.icone] || Trophy;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    c.desbloqueada
                      ? "bg-success/10 border border-success/20"
                      : "bg-muted/50"
                  }`}
                >
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                      c.desbloqueada
                        ? "bg-success text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.desbloqueada ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{c.nome}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        +{c.pontos}pts
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                    {!c.desbloqueada && (
                      <Progress value={c.progresso} className="h-1.5 mt-1.5" />
                    )}
                  </div>
                  {c.desbloqueada && (
                    <CheckCircle className="h-5 w-5 text-success shrink-0" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              Ranking do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Nenhuma entrega este mês ainda
              </p>
            )}
            {ranking.slice(0, 10).map((r) => (
              <div
                key={r.posicao}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  r.isMe ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                }`}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{
                    background:
                      r.posicao === 1
                        ? "linear-gradient(135deg, #ffd700, #ffb700)"
                        : r.posicao === 2
                        ? "linear-gradient(135deg, #c0c0c0, #a0a0a0)"
                        : r.posicao === 3
                        ? "linear-gradient(135deg, #cd7f32, #b87333)"
                        : "hsl(var(--muted))",
                    color: r.posicao <= 3 ? "white" : "inherit",
                  }}
                >
                  {r.posicao}
                </div>
                <div className="flex-1">
                <p className="font-medium text-sm">
                    {r.isMe ? r.nome : `Entregador #${r.posicao}`} {r.isMe && <Badge className="ml-1 text-[10px]">Você</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.entregas} entregas</p>
                </div>
                <span className="font-bold text-primary text-sm">{r.pontos}pts</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </EntregadorLayout>
  );
}
