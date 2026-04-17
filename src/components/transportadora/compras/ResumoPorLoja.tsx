import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Store, Package } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/transp-utils";

interface Props {
  compras: any[];
  unidadesMap: Map<string, string>; // id -> nome
}

type Tipo = "cheio" | "vasilhame";
type Linha = { unidadeId: string | null; loja: string; produto: string; tipo: Tipo; qtd: number; total: number; precoMedio: number };

function detectarProduto(c: any): string | null {
  const desc = String(c.produto_descricao || "").toLowerCase();
  const q13 = Number(c.qtd_p13 || 0);
  const q20 = Number(c.qtd_p20 || 0);
  const q45 = Number(c.qtd_p45 || 0);
  if (q13 > 0) return "P13";
  if (q20 > 0) return "P20";
  if (q45 > 0) return "P45";
  // Para vasilhame qtd_pXX = 0 → detecta pela descrição
  if (/p[\s-]?13|13\s*kg/.test(desc)) return "P13";
  if (/p[\s-]?20|20\s*kg/.test(desc)) return "P20";
  if (/p[\s-]?45|45\s*kg/.test(desc)) return "P45";
  return null;
}

export function ResumoPorLoja({ compras, unidadesMap }: Props) {
  const { linhas, totalQtd, totalValor } = useMemo(() => {
    const map = new Map<string, { unidadeId: string | null; loja: string; produto: string; tipo: Tipo; qtd: number; total: number }>();
    compras.forEach((c) => {
      const tipo: Tipo = c.tipo_produto === "vasilhame" ? "vasilhame" : "cheio";
      if (c.tipo_produto && c.tipo_produto !== "cheio" && c.tipo_produto !== "vasilhame") return;
      const produto = detectarProduto(c);
      if (!produto) return;
      const qtdCheio = Number(c[`qtd_${produto.toLowerCase()}`] || 0);
      // Vasilhame: qtd vem do campo `quantidade` (qtd_pXX é 0 por design)
      const qtd = tipo === "cheio" ? qtdCheio : Number(c.quantidade || 0);
      if (qtd <= 0) return;
      const unidadeId: string | null = c.unidade_id || null;
      const loja = unidadeId ? (unidadesMap.get(unidadeId) || "Sem filial") : "Sem filial";
      const key = `${unidadeId || "_"}__${tipo}__${produto}`;
      const r = map.get(key) || { unidadeId, loja, produto, tipo, qtd: 0, total: 0 };
      r.qtd += qtd;
      r.total += Number(c.custo_total || 0);
      map.set(key, r);
    });
    const linhas: Linha[] = Array.from(map.values())
      .map((r) => ({ ...r, precoMedio: r.qtd > 0 ? r.total / r.qtd : 0 }))
      .sort((a, b) =>
        a.loja.localeCompare(b.loja) ||
        a.tipo.localeCompare(b.tipo) ||
        a.produto.localeCompare(b.produto)
      );
    const totalQtd = linhas.reduce((s, l) => s + l.qtd, 0);
    const totalValor = linhas.reduce((s, l) => s + l.total, 0);
    return { linhas, totalQtd, totalValor };
  }, [compras, unidadesMap]);

  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <p className="font-semibold text-sm text-foreground">Resumo por Loja — Cheio &amp; Vasilhame</p>
        </div>
        {linhas.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sem compras no período</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  {["Loja", "Tipo", "Produto", "Qtd", "Preço Médio Unit.", "Total Líquido"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {linhas.map((l, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground">{l.loja}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold border ${
                        l.tipo === "cheio"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}>
                        {l.tipo === "cheio" ? "Cheio" : "Vasilhame"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 text-[10px] font-semibold">
                        <Package className="h-3 w-3" /> {l.produto}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{formatNumber(l.qtd, 0)}</td>
                    <td className="px-3 py-2 text-primary font-semibold">{formatCurrency(l.precoMedio)}</td>
                    <td className="px-3 py-2 font-bold text-foreground">{formatCurrency(l.total)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-bold">
                  <td className="px-3 py-2 text-foreground" colSpan={3}>Total Geral</td>
                  <td className="px-3 py-2 text-foreground">{formatNumber(totalQtd, 0)}</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2 text-foreground">{formatCurrency(totalValor)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
