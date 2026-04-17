import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/transp-utils";

interface Props {
  compras: any[];
}

type ProdutoKey = "P13" | "P20" | "P45";

function detectarProduto(c: any): ProdutoKey | null {
  const desc = String(c.produto_descricao || "").toLowerCase();
  if (Number(c.qtd_p13 || 0) > 0) return "P13";
  if (Number(c.qtd_p20 || 0) > 0) return "P20";
  if (Number(c.qtd_p45 || 0) > 0) return "P45";
  if (/p[\s-]?13|13\s*kg/.test(desc)) return "P13";
  if (/p[\s-]?20|20\s*kg/.test(desc)) return "P20";
  if (/p[\s-]?45|45\s*kg/.test(desc)) return "P45";
  return null;
}

const LABEL: Record<ProdutoKey, string> = {
  P13: "GÁS - GLP 13 KG",
  P20: "GLP 20 KG",
  P45: "GLP 45 KG",
};

export function ResumoProdutosPrecos({ compras }: Props) {
  const [showAllPU, setShowAllPU] = useState(false);

  // Apenas CHEIO
  const cheios = useMemo(
    () => compras.filter((c) => (c.tipo_produto || "cheio") === "cheio"),
    [compras]
  );

  // Totais por produto
  const totaisPorProduto = useMemo(() => {
    const map = new Map<ProdutoKey, { qtd: number; total: number }>();
    cheios.forEach((c) => {
      const prod = detectarProduto(c);
      if (!prod) return;
      const qtd = Number(c[`qtd_${prod.toLowerCase()}`] || c.quantidade || 0);
      if (qtd <= 0) return;
      const r = map.get(prod) || { qtd: 0, total: 0 };
      r.qtd += qtd;
      r.total += Number(c.custo_total || 0);
      map.set(prod, r);
    });
    const linhas = (["P13", "P45", "P20"] as ProdutoKey[])
      .filter((k) => map.has(k))
      .map((k) => {
        const r = map.get(k)!;
        return { produto: k, label: LABEL[k], qtd: r.qtd, total: r.total, precoMedio: r.qtd > 0 ? r.total / r.qtd : 0 };
      });
    const totalQtd = linhas.reduce((s, l) => s + l.qtd, 0);
    const totalValor = linhas.reduce((s, l) => s + l.total, 0);
    const precoMedioGeral = totalQtd > 0 ? totalValor / totalQtd : 0;
    return { linhas, totalQtd, totalValor, precoMedioGeral };
  }, [cheios]);

  // Quantidade por Preço Unitário
  const porPrecoUnit = useMemo(() => {
    const map = new Map<string, { precoUnit: number; produto: ProdutoKey; qtd: number }>();
    cheios.forEach((c) => {
      const prod = detectarProduto(c);
      if (!prod) return;
      const qtd = Number(c[`qtd_${prod.toLowerCase()}`] || c.quantidade || 0);
      const pu = Number(c.preco_unitario || 0);
      if (qtd <= 0 || pu <= 0) return;
      const key = `${prod}__${pu.toFixed(2)}`;
      const r = map.get(key) || { precoUnit: pu, produto: prod, qtd: 0 };
      r.qtd += qtd;
      map.set(key, r);
    });
    return Array.from(map.values()).sort((a, b) => b.precoUnit - a.precoUnit);
  }, [cheios]);

  const puDisplay = showAllPU ? porPrecoUnit : porPrecoUnit.slice(0, 8);

  if (cheios.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Totais por Produto */}
      <Card className="border-border/40">
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2.5 font-semibold text-foreground">Totais por Produto</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">Qtd Total</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">Preço Médio Unit.</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {totaisPorProduto.linhas.map((l) => (
                  <tr key={l.produto} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-semibold text-foreground">{l.label}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{formatNumber(l.qtd, 0)} un</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(l.precoMedio)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-destructive">{formatCurrency(l.total)}</td>
                  </tr>
                ))}
                <tr className="bg-primary/5 font-bold">
                  <td className="px-3 py-2.5 text-foreground">TOTAL GERAL</td>
                  <td className="px-3 py-2.5 text-right text-foreground">{formatNumber(totaisPorProduto.totalQtd, 0)} un</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(totaisPorProduto.precoMedioGeral)}</td>
                  <td className="px-3 py-2.5 text-right text-destructive">{formatCurrency(totaisPorProduto.totalValor)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quantidade por Preço Unitário */}
      <Card className="border-border/40">
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2.5 font-semibold text-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Quantidade por Preço Unitário
                  </th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {puDisplay.map((l, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-foreground">{formatCurrency(l.precoUnit)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{LABEL[l.produto]}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-foreground">{formatNumber(l.qtd, 0)} un</td>
                  </tr>
                ))}
                {porPrecoUnit.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-4 text-muted-foreground">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {porPrecoUnit.length > 8 && (
            <div className="p-2 border-t border-border/40 text-center">
              <Button variant="ghost" size="sm" onClick={() => setShowAllPU(!showAllPU)} className="text-primary text-xs h-7">
                {showAllPU ? <><ChevronUp className="h-3 w-3 mr-1" />Mostrar menos</> : <><ChevronDown className="h-3 w-3 mr-1" />Mostrar mais ({porPrecoUnit.length - 8})</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
