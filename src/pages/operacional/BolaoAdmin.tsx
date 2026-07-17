import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useBolaoJogos, useFinalizarJogo, useImportarTabela, BolaoJogo } from "@/hooks/useBolao";
import { FASE_LABELS, FASE_ORDEM, BolaoFase } from "@/lib/bolao/fixture2026";
import { Bandeira } from "@/components/bolao/Bandeira";
import { Download, Lock, Unlock, Search, Trophy, CheckCircle2, Clock, CalendarRange } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function CardJogo({ jogo, onSalvar }: { jogo: BolaoJogo; onSalvar: (c: number, f: number, fin: boolean) => void }) {
  const [casa, setCasa] = useState(jogo.gols_casa_real?.toString() ?? "");
  const [fora, setFora] = useState(jogo.gols_fora_real?.toString() ?? "");

  const finalizar = () => {
    const c = parseInt(casa, 10);
    const f = parseInt(fora, 10);
    if (Number.isNaN(c) || Number.isNaN(f)) return;
    onSalvar(c, f, true);
  };
  const reabrir = () => onSalvar(jogo.gols_casa_real ?? 0, jogo.gols_fora_real ?? 0, false);

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md overflow-hidden",
        jogo.finalizado && "border-success/40 bg-success/[0.03]"
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header com número e data */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono font-semibold">Jogo #{jogo.numero_jogo}</span>
          <span>{format(new Date(jogo.data_jogo), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
        </div>

        {/* Confronto */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Casa */}
          <div className="flex items-center justify-end gap-2 min-w-0">
            <span className="text-sm font-semibold truncate">{jogo.time_casa}</span>
            <Bandeira codigo={jogo.codigo_casa} size={24} />
          </div>

          {/* Placar */}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={casa}
              onChange={(e) => setCasa(e.target.value)}
              className="w-12 h-10 text-center text-base font-bold p-0"
            />
            <span className="text-muted-foreground font-semibold">×</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={fora}
              onChange={(e) => setFora(e.target.value)}
              className="w-12 h-10 text-center text-base font-bold p-0"
            />
          </div>

          {/* Fora */}
          <div className="flex items-center gap-2 min-w-0">
            <Bandeira codigo={jogo.codigo_fora} size={24} />
            <span className="text-sm font-semibold truncate">{jogo.time_fora}</span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between pt-1">
          {jogo.finalizado ? (
            <Badge variant="outline" className="border-success/40 text-success gap-1">
              <CheckCircle2 className="h-3 w-3" /> Finalizado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <Clock className="h-3 w-3" /> Pendente
            </Badge>
          )}
          {jogo.finalizado ? (
            <Button size="sm" variant="ghost" onClick={reabrir} className="h-8">
              <Unlock className="h-3.5 w-3.5 mr-1" /> Reabrir
            </Button>
          ) : (
            <Button size="sm" onClick={finalizar} className="h-8">
              <Lock className="h-3.5 w-3.5 mr-1" /> Finalizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BolaoAdmin() {
  const { unidadeAtual } = useUnidade();
  const { data: jogos = [], isLoading } = useBolaoJogos(unidadeAtual?.id);
  const finalizar = useFinalizarJogo(unidadeAtual?.id);
  const importar = useImportarTabela(unidadeAtual?.id);

  const [busca, setBusca] = useState("");
  const [faseAtiva, setFaseAtiva] = useState<BolaoFase | "todas">("todas");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "pendente" | "finalizado">("todos");
  const [modoSequencia, setModoSequencia] = useState(false);

  const stats = useMemo(() => {
    const total = jogos.length;
    const finalizados = jogos.filter((j) => j.finalizado).length;
    return { total, finalizados, pendentes: total - finalizados };
  }, [jogos]);

  const jogosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return jogos.filter((j) => {
      if (faseAtiva !== "todas" && j.fase !== faseAtiva) return false;
      if (statusFiltro === "pendente" && j.finalizado) return false;
      if (statusFiltro === "finalizado" && !j.finalizado) return false;
      if (q && !j.time_casa.toLowerCase().includes(q) && !j.time_fora.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jogos, busca, faseAtiva, statusFiltro]);

  const jogosPorFase = useMemo(() => {
    const m = new Map<BolaoFase, BolaoJogo[]>();
    jogosFiltrados.forEach((j) => {
      const arr = m.get(j.fase) || [];
      arr.push(j);
      m.set(j.fase, arr);
    });
    return m;
  }, [jogosFiltrados]);

  const jogosPorDia = useMemo(() => {
    const m = new Map<string, BolaoJogo[]>();
    [...jogosFiltrados]
      .sort((a, b) => new Date(a.data_jogo).getTime() - new Date(b.data_jogo).getTime())
      .forEach((j) => {
        const k = format(new Date(j.data_jogo), "yyyy-MM-dd");
        const arr = m.get(k) || [];
        arr.push(j);
        m.set(k, arr);
      });
    return m;
  }, [jogosFiltrados]);

  const contagemPorFase = useMemo(() => {
    const m = new Map<BolaoFase, number>();
    jogos.forEach((j) => m.set(j.fase, (m.get(j.fase) || 0) + 1));
    return m;
  }, [jogos]);

  return (
    <MainLayout>
      <Header
        title="Bolão Copa 2026 — Admin"
        subtitle="Cadastre placares reais para calcular pontos dos entregadores"
      />
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Stats + import */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total de jogos</div>
                <div className="text-xl font-bold">{stats.total}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Finalizados</div>
                <div className="text-xl font-bold text-success">{stats.finalizados}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
                <div className="text-xl font-bold text-warning">{stats.pendentes}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="flex items-center justify-center">
            <CardContent className="p-3 w-full">
              <Button
                onClick={() => {
                  if (jogos.length > 0) {
                    if (!window.confirm("Reimportar apaga os jogos atuais e TODOS os palpites desta unidade. Continuar?")) return;
                    importar.mutate({ reimportar: true });
                  } else {
                    importar.mutate({});
                  }
                }}
                disabled={importar.isPending}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {jogos.length > 0 ? "Reimportar tabela oficial" : "Importar tabela"}
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Filtros */}
        {jogos.length > 0 && (
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar seleção..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as typeof statusFiltro)}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="finalizado">Finalizados</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={faseAtiva}
                  onValueChange={(v) => setFaseAtiva(v as typeof faseAtiva)}
                  disabled={modoSequencia}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Fase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as fases ({jogos.length})</SelectItem>
                    {FASE_ORDEM.map((f) => {
                      const c = contagemPorFase.get(f) || 0;
                      if (c === 0) return null;
                      return (
                        <SelectItem key={f} value={f}>
                          {FASE_LABELS[f]} ({c})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Toggle
                  pressed={modoSequencia}
                  onPressedChange={setModoSequencia}
                  variant="outline"
                  aria-label="Mostrar em sequência por data"
                  className="w-full sm:w-auto gap-2"
                >
                  <CalendarRange className="h-4 w-4" />
                  Em sequência
                </Toggle>
              </div>

            </CardContent>
          </Card>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : jogos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium mb-1">Nenhum jogo cadastrado</p>
              <p className="text-sm">Clique em "Importar tabela" para começar.</p>
            </CardContent>
          </Card>
        ) : jogosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              Nenhum jogo encontrado com esses filtros.
            </CardContent>
          </Card>
        ) : modoSequencia ? (
          Array.from(jogosPorDia.entries()).map(([dia, lista]) => (
            <section key={dia} className="space-y-2">
              <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
                <div className="h-7 w-1 bg-primary rounded-full" />
                <h2 className="text-lg font-bold capitalize">
                  {format(new Date(`${dia}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h2>
                <Badge variant="secondary">{lista.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {lista.map((j) => (
                  <CardJogo
                    key={j.id}
                    jogo={j}
                    onSalvar={(c, f, fin) =>
                      finalizar.mutate({ jogo_id: j.id, gols_casa: c, gols_fora: f, finalizado: fin })
                    }
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          FASE_ORDEM.map((fase) => {
            const lista = jogosPorFase.get(fase) || [];
            if (lista.length === 0) return null;

            // Para fase de grupos, agrupa por letra do grupo
            if (fase === "grupos") {
              const porGrupo = new Map<string, BolaoJogo[]>();
              lista.forEach((j) => {
                const g = j.grupo || "—";
                const arr = porGrupo.get(g) || [];
                arr.push(j);
                porGrupo.set(g, arr);
              });
              const grupos = Array.from(porGrupo.keys()).sort();

              return (
                <section key={fase} className="space-y-3">
                  <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
                    <div className="h-7 w-1 bg-primary rounded-full" />
                    <h2 className="text-lg font-bold">{FASE_LABELS[fase]}</h2>
                    <Badge variant="secondary">{lista.length}</Badge>
                  </div>
                  {grupos.map((g) => (
                    <div key={g} className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Grupo {g}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {porGrupo.get(g)!.map((j) => (
                          <CardJogo
                            key={j.id}
                            jogo={j}
                            onSalvar={(c, f, fin) =>
                              finalizar.mutate({ jogo_id: j.id, gols_casa: c, gols_fora: f, finalizado: fin })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              );
            }

            return (
              <section key={fase} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
                  <div className="h-7 w-1 bg-primary rounded-full" />
                  <h2 className="text-lg font-bold">{FASE_LABELS[fase]}</h2>
                  <Badge variant="secondary">{lista.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lista.map((j) => (
                    <CardJogo
                      key={j.id}
                      jogo={j}
                      onSalvar={(c, f, fin) =>
                        finalizar.mutate({ jogo_id: j.id, gols_casa: c, gols_fora: f, finalizado: fin })
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </MainLayout>
  );
}
