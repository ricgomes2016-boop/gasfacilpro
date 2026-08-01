import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/transp-utils";
import { Package } from "lucide-react";

interface Props {
  compras: any[];
}

const PRODUTOS = [
  { key: "p13", label: "P13", qtdField: "qtd_p13", custoField: "custo_unit_p13" },
  { key: "p20", label: "P20", qtdField: "qtd_p20", custoField: "custo_unit_p20" },
  { key: "p45", label: "P45", qtdField: "qtd_p45", custoField: "custo_unit_p45" },
  { key: "agua", label: "Água", qtdField: "qtd_agua", custoField: "custo_unit_agua" },
];

export function ComprasProdutos({ compras }: Props) {
  const resumo = useMemo(() => {
    return PRODUTOS.map((p) => {
      let totalQtd = 0, totalLiquido = 0;
      let menor = Infinity, maior = 0;
      compras.forEach((c) => {
        const totalBrutoNF = PRODUTOS.reduce((sum, prod) => {
          const qtdProduto = Number(c[prod.qtdField] || 0);
          const custoProduto = Number(c[prod.custoField] || 0);
          return sum + qtdProduto * custoProduto;
        }, 0);
        const q = Number(c[p.qtdField] || 0);
        const u = Number(c[p.custoField] || 0);
        if (q > 0) {
          const desc = Number(c.desconto || 0);
          const valorBruto = u * q;
          const descRateado = totalBrutoNF > 0 ? (desc * valorBruto) / totalBrutoNF : 0;
          const valorLiquido = Math.max(0, valorBruto - descRateado);
          const uLiquido = q > 0 ? valorLiquido / q : u;

          totalQtd += q;
          totalLiquido += valorLiquido;
          if (uLiquido < menor) menor = uLiquido;
          if (uLiquido > maior) maior = uLiquido;
        }
      });
      return {
        ...p,
        totalQtd,
        precoMedio: totalQtd > 0 ? totalLiquido / totalQtd : 0,
        menor: menor === Infinity ? 0 : menor,
        maior,
        totalGasto: totalLiquido,
      };
    });
  }, [compras]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {resumo.map((p) => (
        <Card key={p.key} className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <p className="font-semibold text-foreground">{p.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{p.totalQtd.toLocaleString("pt-BR")} un</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Preço médio</p>
                <p className="font-bold text-primary">{formatCurrency(p.precoMedio)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total gasto</p>
                <p className="font-bold text-foreground">{formatCurrency(p.totalGasto)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Menor preço</p>
                <p className="font-medium text-foreground">{formatCurrency(p.menor)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Maior preço</p>
                <p className="font-medium text-foreground">{formatCurrency(p.maior)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
