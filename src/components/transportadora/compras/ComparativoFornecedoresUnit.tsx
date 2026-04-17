import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Trophy, TrendingDown } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/transp-utils";

interface Props { compras: any[]; }

const PRODUTOS = ["P13", "P20", "P45"] as const;
type Prod = typeof PRODUTOS[number];

function qtdProduto(c: any, p: Prod): number {
  return Number(c[`qtd_${p.toLowerCase()}`] || 0);
}
function precoUnit(c: any, p: Prod): number {
  // Preferir preco_unitario (do XML) se disponível e produto bate; senão usar custo_unit_pX
  const pu = Number(c.preco_unitario || 0);
  const ck = Number(c[`custo_unit_${p.toLowerCase()}`] || 0);
  return pu > 0 ? pu : ck;
}

export function ComparativoFornecedoresUnit({ compras }: Props) {
  const [produto, setProduto] = useState<Prod>("P13");

  const { rows, globalAvg, best, variacao } = useMemo(() => {
    const map = new Map<string, { fornecedor: string; precos: number[]; qtd: number; total: number }>();
    compras.forEach((c) => {
      if (c.tipo_produto && c.tipo_produto !== "cheio") return;
      const q = qtdProduto(c, produto);
      const u = precoUnit(c, produto);
      const f = c.fornecedor;
      if (!f || q <= 0 || u <= 0) return;
      const r = map.get(f) || { fornecedor: f, precos: [], qtd: 0, total: 0 };
      r.precos.push(u);
      r.qtd += q;
      r.total += u * q;
      map.set(f, r);
    });

    const rows = Array.from(map.values())
      .map((s) => ({
        fornecedor: s.fornecedor.length > 22 ? s.fornecedor.slice(0, 22) + "…" : s.fornecedor,
        fullName: s.fornecedor,
        avg: s.qtd > 0 ? s.total / s.qtd : 0,
        min: Math.min(...s.precos),
        max: Math.max(...s.precos),
        qty: s.qtd,
        total: s.total,
      }))
      .sort((a, b) => a.avg - b.avg);

    const totalQtd = rows.reduce((s, r) => s + r.qty, 0);
    const globalAvg = totalQtd > 0 ? rows.reduce((s, r) => s + r.avg * r.qty, 0) / totalQtd : 0;
    const best = rows[0];
    const variacao = rows.length > 1 ? rows[rows.length - 1].avg - best.avg : 0;
    return { rows, globalAvg, best, variacao };
  }, [compras, produto]);

  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-sm text-foreground">Comparativo de Preço Unitário por Fornecedor — GLP Cheio</p>
            <p className="text-xs text-muted-foreground mt-0.5">Identifique quem oferece as melhores margens</p>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {PRODUTOS.map((p) => (
              <button
                key={p}
                onClick={() => setProduto(p)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  produto === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">Sem dados de {produto} cheio para comparar</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 bg-success/10 text-success border border-success/20 rounded-md px-2.5 py-1 font-medium">
                <Trophy className="h-3 w-3" /> Melhor: <strong>{best.fullName}</strong> · {formatCurrency(best.avg)}/un
              </span>
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-2.5 py-1">
                📊 Média: <strong>{formatCurrency(globalAvg)}</strong>
              </span>
              {rows.length > 1 && (
                <span className="inline-flex items-center gap-1.5 bg-warning/10 text-warning border border-warning/20 rounded-md px-2.5 py-1">
                  <TrendingDown className="h-3 w-3" /> Variação: <strong>{formatCurrency(variacao)}</strong>
                </span>
              )}
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fornecedor" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]}
                  labelFormatter={(_, payload) => {
                    const r = payload?.[0]?.payload;
                    return r ? `${r.fullName} · ${formatNumber(r.qty, 0)} un` : "";
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={globalAvg} stroke="hsl(var(--primary))" strokeDasharray="4 2" />
                <Bar dataKey="min" name="Menor" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avg" name="Médio" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max" name="Maior" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    {["Fornecedor", "Min", "Médio", "Max", "Qtd", "Total Pago", "vs. Média"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((r, i) => {
                    const diff = r.avg - globalAvg;
                    return (
                      <tr key={r.fullName} className={`hover:bg-muted/30 ${i === 0 ? "bg-success/5" : ""}`}>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {i === 0 && <Trophy className="inline h-3 w-3 text-success mr-1" />}
                          {r.fullName}
                        </td>
                        <td className="px-3 py-2 text-success font-medium">{formatCurrency(r.min)}</td>
                        <td className="px-3 py-2 font-semibold text-foreground">{formatCurrency(r.avg)}</td>
                        <td className="px-3 py-2 text-destructive">{formatCurrency(r.max)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatNumber(r.qty, 0)}</td>
                        <td className="px-3 py-2 text-foreground">{formatCurrency(r.total)}</td>
                        <td className={`px-3 py-2 font-medium ${diff <= 0 ? "text-success" : "text-destructive"}`}>
                          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
