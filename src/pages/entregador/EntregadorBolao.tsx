import { useState, useMemo } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBolaoJogos, useMeusPalpites, useSalvarPalpite, useRankingBolao, BolaoJogo, BolaoPalpite } from "@/hooks/useBolao";
import { FASE_LABELS, FASE_ORDEM, BolaoFase } from "@/lib/bolao/fixture2026";
import { Trophy, Calendar, CheckCircle2, Lock, Medal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

function JogoCard({
  jogo,
  palpite,
  onSalvar,
}: {
  jogo: BolaoJogo;
  palpite?: BolaoPalpite;
  onSalvar: (casa: number, fora: number) => void;
}) {
  const [casa, setCasa] = useState<string>(palpite ? String(palpite.gols_casa_palpite) : "");
  const [fora, setFora] = useState<string>(palpite ? String(palpite.gols_fora_palpite) : "");
  const bloqueado = jogo.finalizado || new Date(jogo.data_jogo) <= new Date();
  const acertou = palpite && jogo.finalizado && palpite.pontos > 0;

  const salvar = () => {
    const c = parseInt(casa, 10);
    const f = parseInt(fora, 10);
    if (Number.isNaN(c) || Number.isNaN(f)) return;
    if (palpite && palpite.gols_casa_palpite === c && palpite.gols_fora_palpite === f) return;
    onSalvar(c, f);
  };

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(jogo.data_jogo), "dd/MM HH:mm", { locale: ptBR })}
          </span>
          {jogo.grupo && <span className="font-semibold">Grupo {jogo.grupo}</span>}
          <span>#{jogo.numero_jogo}</span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <div className="text-right">
            <p className="text-sm font-semibold truncate">{jogo.time_casa}</p>
            {jogo.codigo_casa && <p className="text-[10px] text-muted-foreground">{jogo.codigo_casa}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              value={casa}
              onChange={(e) => setCasa(e.target.value)}
              onBlur={salvar}
              disabled={bloqueado}
              className="w-12 h-10 text-center text-base font-bold p-0"
            />
            <span className="text-muted-foreground font-bold">×</span>
            <Input
              type="number"
              min={0}
              value={fora}
              onChange={(e) => setFora(e.target.value)}
              onBlur={salvar}
              disabled={bloqueado}
              className="w-12 h-10 text-center text-base font-bold p-0"
            />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold truncate">{jogo.time_fora}</p>
            {jogo.codigo_fora && <p className="text-[10px] text-muted-foreground">{jogo.codigo_fora}</p>}
          </div>
        </div>

        {jogo.finalizado && jogo.gols_casa_real !== null && jogo.gols_fora_real !== null && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">Resultado real</span>
            <span className="font-bold text-sm">
              {jogo.gols_casa_real} × {jogo.gols_fora_real}
            </span>
            {palpite ? (
              <Badge
                variant="outline"
                className={
                  palpite.pontos === 10
                    ? "border-emerald-500/40 text-emerald-600"
                    : palpite.pontos === 5
                    ? "border-blue-500/40 text-blue-600"
                    : "border-muted-foreground/30 text-muted-foreground"
                }
              >
                {acertou && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {palpite.pontos} pts
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Sem palpite</Badge>
            )}
          </div>
        )}

        {bloqueado && !jogo.finalizado && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Palpites encerrados — aguardando resultado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function EntregadorBolao() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const { data: jogos = [], isLoading } = useBolaoJogos(unidadeAtual?.id);
  const { data: meusPalpites = [] } = useMeusPalpites(unidadeAtual?.id);
  const { data: ranking = [] } = useRankingBolao(unidadeAtual?.id);
  const salvar = useSalvarPalpite(unidadeAtual?.id);

  const palpitesPorJogo = useMemo(() => {
    const m = new Map<string, BolaoPalpite>();
    meusPalpites.forEach((p) => m.set(p.jogo_id, p));
    return m;
  }, [meusPalpites]);

  const jogosPorFase = useMemo(() => {
    const m = new Map<BolaoFase, BolaoJogo[]>();
    jogos.forEach((j) => {
      const arr = m.get(j.fase) || [];
      arr.push(j);
      m.set(j.fase, arr);
    });
    return m;
  }, [jogos]);

  const meusStats = useMemo(() => {
    const total = meusPalpites.reduce((acc, p) => acc + (p.pontos || 0), 0);
    const exatos = meusPalpites.filter((p) => p.pontos === 10).length;
    const vencedores = meusPalpites.filter((p) => p.pontos === 5).length;
    const finalizados = jogos.filter((j) => j.finalizado).length;
    return { total, exatos, vencedores, palpites: meusPalpites.length, finalizados };
  }, [meusPalpites, jogos]);

  const minhaPos = useMemo(() => {
    if (!user?.id) return null;
    const idx = ranking.findIndex((r) => r.user_id === user.id);
    return idx >= 0 ? idx + 1 : null;
  }, [ranking, user]);

  return (
    <EntregadorLayout title="Bolão Copa 2026">
      <div className="p-3 space-y-3">
        <Card className="border-none bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8" />
            <div className="flex-1">
              <p className="text-xs opacity-80">Seus pontos</p>
              <p className="text-2xl font-bold">{meusStats.total}</p>
            </div>
            {minhaPos && (
              <div className="text-right">
                <p className="text-xs opacity-80">Posição</p>
                <p className="text-2xl font-bold">{minhaPos}º</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="jogos">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jogos">Jogos</TabsTrigger>
            <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          <TabsContent value="jogos" className="space-y-4 mt-3">
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : jogos.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum jogo cadastrado ainda. Peça ao gestor para importar a tabela oficial.
                </CardContent>
              </Card>
            ) : (
              FASE_ORDEM.map((fase) => {
                const lista = jogosPorFase.get(fase) || [];
                if (lista.length === 0) return null;
                return (
                  <div key={fase} className="space-y-2">
                    <h3 className="text-sm font-bold px-1">{FASE_LABELS[fase]}</h3>
                    <div className="space-y-2">
                      {lista.map((j) => (
                        <JogoCard
                          key={j.id}
                          jogo={j}
                          palpite={palpitesPorJogo.get(j.id)}
                          onSalvar={(c, f) =>
                            salvar.mutate({ jogo_id: j.id, gols_casa: c, gols_fora: f })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="desempenho" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Placares exatos</p>
                <p className="text-2xl font-bold text-emerald-600">{meusStats.exatos}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Vencedor certo</p>
                <p className="text-2xl font-bold text-blue-600">{meusStats.vencedores}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Palpites feitos</p>
                <p className="text-2xl font-bold">{meusStats.palpites}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Jogos finalizados</p>
                <p className="text-2xl font-bold">{meusStats.finalizados}</p>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="space-y-2 mt-3">
            {ranking.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhum palpite registrado ainda.
              </CardContent></Card>
            ) : (
              ranking.map((r, i) => {
                const isMe = r.user_id === user?.id;
                return (
                  <Card key={r.user_id} className={isMe ? "border-primary" : ""}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? "bg-yellow-500/20 text-yellow-700" :
                        i === 1 ? "bg-gray-400/20 text-gray-700" :
                        i === 2 ? "bg-orange-700/20 text-orange-800" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{r.nome}{isMe && " (você)"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.exatos} exatos · {r.vencedores} vencedor · {r.palpites} palpites
                        </p>
                      </div>
                      <Badge variant="outline" className="font-bold">{r.pontos} pts</Badge>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </EntregadorLayout>
  );
}
