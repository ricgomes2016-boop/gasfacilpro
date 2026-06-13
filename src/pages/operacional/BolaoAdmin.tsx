import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useBolaoJogos, useFinalizarJogo, useImportarTabela, BolaoJogo } from "@/hooks/useBolao";
import { FASE_LABELS, FASE_ORDEM, BolaoFase } from "@/lib/bolao/fixture2026";
import { Download, Lock, Unlock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

function LinhaJogo({ jogo, onSalvar }: { jogo: BolaoJogo; onSalvar: (c: number, f: number, fin: boolean) => void }) {
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
    <Card>
      <CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground w-20">#{jogo.numero_jogo}</div>
        <div className="text-xs text-muted-foreground w-28">
          {format(new Date(jogo.data_jogo), "dd/MM HH:mm", { locale: ptBR })}
        </div>
        <div className="flex-1 min-w-[200px] grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="text-sm font-semibold text-right truncate">{jogo.time_casa}</span>
          <div className="flex items-center gap-1">
            <Input type="number" min={0} value={casa} onChange={(e) => setCasa(e.target.value)} className="w-14 text-center" />
            <span>×</span>
            <Input type="number" min={0} value={fora} onChange={(e) => setFora(e.target.value)} className="w-14 text-center" />
          </div>
          <span className="text-sm font-semibold truncate">{jogo.time_fora}</span>
        </div>
        {jogo.finalizado ? (
          <>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Finalizado</Badge>
            <Button size="sm" variant="outline" onClick={reabrir}>
              <Unlock className="h-3 w-3 mr-1" /> Reabrir
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={finalizar}>
            <Lock className="h-3 w-3 mr-1" /> Finalizar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function BolaoAdmin() {
  const { unidadeAtual } = useUnidade();
  const { data: jogos = [], isLoading } = useBolaoJogos(unidadeAtual?.id);
  const finalizar = useFinalizarJogo(unidadeAtual?.id);
  const importar = useImportarTabela(unidadeAtual?.id);

  const jogosPorFase = useMemo(() => {
    const m = new Map<BolaoFase, BolaoJogo[]>();
    jogos.forEach((j) => {
      const arr = m.get(j.fase) || [];
      arr.push(j);
      m.set(j.fase, arr);
    });
    return m;
  }, [jogos]);

  return (
    <MainLayout>
      <Header title="Bolão Copa 2026 — Admin" subtitle="Cadastre placares reais para calcular pontos dos entregadores" />
      <div className="p-4 space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() => importar.mutate()}
            disabled={importar.isPending || jogos.length > 0}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            {jogos.length > 0 ? `Tabela já importada (${jogos.length} jogos)` : "Importar tabela oficial"}
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-40" />
        ) : jogos.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            Nenhum jogo cadastrado. Clique em "Importar tabela oficial" para começar.
          </CardContent></Card>
        ) : (
          FASE_ORDEM.map((fase) => {
            const lista = jogosPorFase.get(fase) || [];
            if (lista.length === 0) return null;
            return (
              <section key={fase} className="space-y-2">
                <h2 className="text-lg font-bold">{FASE_LABELS[fase]}</h2>
                <div className="space-y-2">
                  {lista.map((j) => (
                    <LinhaJogo
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
