import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription } from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import type { DreLancamento } from "@/lib/financeiro/dreCalculo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: string;
  lancamentos: DreLancamento[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DRELinhaDetalheDialog({ open, onOpenChange, titulo, descricao, lancamentos }: Props) {
  const total = lancamentos.reduce((s, l) => s + l.valor, 0);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-base">{titulo}</ResponsiveDialogTitle>
          {descricao && <ResponsiveDialogDescription className="text-xs">{descricao}</ResponsiveDialogDescription>}
        </ResponsiveDialogHeader>

        <div className="mb-3 flex items-center justify-between rounded-[var(--radius)] border border-border/60 bg-muted/35 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {lancamentos.length} lançamento(s)
          </span>
          <span className="text-sm font-bold tabular-nums">{brl(total)}</span>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-[var(--radius)] border border-border/60">
          {lancamentos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum lançamento neste grupo no período.</p>
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
                {lancamentos.map((l, i) => (
                  <tr key={i} className="border-t border-border/50">
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
