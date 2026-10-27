import { useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { conferenciaApi } from "@/lib/estoque/conferenciaPortal";
import { agruparHistorico, ConferenciaHist, GrupoHist } from "@/lib/estoque/conferenciaHistorico";

const GRUPOS: GrupoHist[] = ["P13", "P20", "P45", "Agua"];
const br = (d: string) => d.split("-").reverse().join("/");
const diaAnterior = (d: string) => format(subDays(new Date(`${d}T12:00:00`), 1), "yyyy-MM-dd");

interface Props {
  portal: boolean;
  unidades: { id: string; nome: string }[];
  onAbrir: (dataContagem: string, momento: "inicio" | "fim") => void;
}

export function HistoricoConferenciasDialog({ portal, unidades, onAbrir }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lista, setLista] = useState<ConferenciaHist[]>([]);
  const nomes = useMemo(() => new Map(unidades.map((u) => [u.id, u.nome])), [unidades]);

  const carregar = async () => {
    setLoading(true); setError("");
    try {
      if (portal) {
        const r = await conferenciaApi({ action: "history" });
        setLista(agruparHistorico(r.closings || [], r.legacy || []));
      } else {
        const ids = unidades.map((u) => u.id);
        const from = format(subDays(new Date(), 120), "yyyy-MM-dd");
        const [c, l] = await Promise.all([
          (supabase as any).from("estoque_conferencia_fechamentos").select("data_conferencia, data_contagem, momento, unidade_id, produto_grupo, tipo_estoque, quantidade").in("unidade_id", ids).gte("data_contagem", from).limit(5000),
          (supabase as any).from("estoque_conferencias").select("data_conferencia, unidade_id, produto_grupo, tipo_estoque, quantidade").in("unidade_id", ids).gte("data_conferencia", from).limit(5000),
        ]);
        if (c.error || l.error) throw c.error || l.error;
        setLista(agruparHistorico(c.data || [], l.data || []));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
    } finally { setLoading(false); }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => { setOpen(true); void carregar(); }}>
        <History className="h-4 w-4" /> Histórico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Histórico de conferências</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Últimos 120 dias. Toque em uma conferência para abrir.</p>
          {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && lista.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conferência encontrada.</p>}
          <div className="flex flex-col gap-3">
            {lista.map((h) => {
              const venda = h.momento === "inicio" ? diaAnterior(h.dataContagem) : h.dataContagem;
              return (
                <button key={h.chave} type="button" onClick={() => { onAbrir(h.dataContagem, h.momento); setOpen(false); }}
                  className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-black">{br(h.dataContagem)} · {h.momento === "inicio" ? "Início do dia" : "Final do dia"}</p>
                    <p className="text-xs text-muted-foreground">Vendas de {br(venda)}</p>
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {h.lojas.length} {h.lojas.length === 1 ? "loja" : "lojas"}: {h.lojas.map((id) => nomes.get(id) || "Loja").join(", ")}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {GRUPOS.map((g) => (
                      <div key={g} className="overflow-hidden rounded-md border border-border">
                        <div className="bg-foreground px-2 py-0.5 text-center text-xs font-black text-background">{g === "Agua" ? "Água" : g}</div>
                        <div className="px-2 py-1 text-center text-xs">
                          <span className="font-bold">{h.totais[g].cheio}</span> cheio · <span className="font-bold">{h.totais[g].vazio}</span> vazio
                          <div className="font-black">Total {h.totais[g].cheio + h.totais[g].vazio}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
