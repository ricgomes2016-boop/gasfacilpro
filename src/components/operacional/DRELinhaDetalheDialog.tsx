import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agruparPorOrigem, lancamentosParaCsv } from "@/lib/financeiro/dreView";
import type { DreLancamento } from "@/lib/financeiro/dreCalculo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: string;
  lancamentos: DreLancamento[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalizar = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function DRELinhaDetalheDialog({ open, onOpenChange, titulo, descricao, lancamentos }: Props) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return lancamentos;
    return lancamentos.filter(
      (l) => normalizar(l.descricao || "").includes(termo) || normalizar(l.origem || "").includes(termo),
    );
  }, [lancamentos, busca]);

  const total = useMemo(() => filtrados.reduce((s, l) => s + Number(l.valor || 0), 0), [filtrados]);
  const origens = useMemo(() => agruparPorOrigem(filtrados), [filtrados]);

  const exportarCsv = () => {
    const csv = lancamentosParaCsv(filtrados);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-${normalizar(titulo).replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-base">{titulo}</ResponsiveDialogTitle>
          {descricao && <ResponsiveDialogDescription className="text-xs">{descricao}</ResponsiveDialogDescription>}
        </ResponsiveDialogHeader>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição ou origem"
              aria-label="Buscar lançamentos desta linha"
              className="h-10 pl-8 text-base sm:h-9 sm:text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 sm:h-9"
            onClick={exportarCsv}
            disabled={filtrados.length === 0}
            aria-label="Exportar lançamentos em CSV"
          >
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border/60 bg-muted/35 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {filtrados.length} lançamento(s)
            {filtrados.length !== lancamentos.length ? ` de ${lancamentos.length}` : ""}
          </span>
          <span className="text-sm font-bold tabular-nums">{brl(total)}</span>
        </div>

        {origens.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {origens.map((o) => (
              <Badge key={o.origem} variant="outline" className="gap-1 text-[11px] font-medium">
                {o.origem}
                <span className="text-muted-foreground">
                  · {o.quantidade} · {brl(o.total)}
                </span>
              </Badge>
            ))}
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto rounded-[var(--radius)] border border-border/60">
          {filtrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {lancamentos.length === 0
                ? "Nenhum lançamento neste grupo no período."
                : "Nenhum lançamento corresponde à busca."}
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-muted/70">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Data</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Descrição</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l, i) => (
                  <tr key={`${l.data}-${i}`} className="border-t border-border/50 odd:bg-muted/15">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {l.data ? l.data.split("-").reverse().join("/") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block leading-snug">{l.descricao}</span>
                      <Badge variant="outline" className="mt-1 text-[10px]">{l.origem}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{brl(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
