import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";

interface AggItem {
  chave: string;
  valor: number;
  count: number;
}

interface Props {
  despesasPorCategoria: AggItem[];
  receitasPorCanal: AggItem[];
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Bloco({
  titulo,
  icone,
  cor,
  itens,
  vazioMsg,
}: {
  titulo: string;
  icone: React.ReactNode;
  cor: string;
  itens: AggItem[];
  vazioMsg: string;
}) {
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  const max = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icone}
        <h4 className="text-sm font-semibold text-[hsl(0,0%,93%)]">{titulo}</h4>
        <span className="text-xs text-[hsl(220,10%,55%)] ml-auto tabular-nums">
          {fmtBRL(total)}
        </span>
      </div>
      {itens.length === 0 ? (
        <p className="text-xs text-[hsl(220,10%,50%)] py-3 text-center">{vazioMsg}</p>
      ) : (
        <div className="space-y-2">
          {itens.map((i) => {
            const pct = total > 0 ? (i.valor / total) * 100 : 0;
            const barPct = (i.valor / max) * 100;
            return (
              <div key={i.chave}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[hsl(0,0%,88%)] truncate capitalize">
                    {i.chave} <span className="text-[hsl(220,10%,55%)]">({i.count})</span>
                  </span>
                  <span className="tabular-nums text-[hsl(220,10%,75%)] shrink-0 ml-2">
                    {fmtBRL(i.valor)}{" "}
                    <span className="text-[hsl(220,10%,50%)]">{pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-[hsl(220,18%,10%)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, background: cor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ConsolidadoCategorias({ despesasPorCategoria, receitasPorCanal }: Props) {
  return (
    <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
      <CardHeader>
        <CardTitle className="text-base text-[hsl(0,0%,95%)]">Consolidado por categoria</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Bloco
          titulo="Receita por canal"
          icone={<TrendingUp className="h-4 w-4 text-[hsl(150,70%,55%)]" />}
          cor="hsl(150,70%,50%)"
          itens={receitasPorCanal}
          vazioMsg="Sem receitas no período."
        />
        <Bloco
          titulo="Despesa por categoria"
          icone={<TrendingDown className="h-4 w-4 text-[hsl(0,75%,65%)]" />}
          cor="hsl(0,75%,55%)"
          itens={despesasPorCategoria}
          vazioMsg="Sem despesas no período."
        />
      </CardContent>
    </Card>
  );
}
