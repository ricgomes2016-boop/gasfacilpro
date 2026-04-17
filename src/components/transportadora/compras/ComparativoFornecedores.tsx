import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Trophy, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/transp-utils";

interface Props { compras: any[]; }

export function ComparativoFornecedores({ compras }: Props) {
  const { rows, globalAvg, best, variacao } = useMemo(() => {
    const map = new Map<string, { fornecedor: string; precos: number[]; qtd: number; total: number }>();
    compras.forEach((c) => {
      const f = c.fornecedor;
      const q = Number(c.qtd_p13 || 0);
      const u = Number(c.custo_unit_p13 || 0);
      if (!f || q <= 0 || u <= 0) return;
      const r = map.get(f) || { fornecedor: f, precos: [], qtd: 0, total: 0 };
      r.precos.push(u);
      r.qtd += q;
      r.total += u * q;
      map.set(f, r);
    });

    const rows = Array.from(map.values())
      .map((s) => ({
        fornecedor: s.fornecedor.length > 20 ? s.fornecedor.slice(0, 20) + "…" : s.fornecedor,
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
  }, [compras]);

  if (rows.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Sem dados de P13 com fornecedor para comparar
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="font-semibold text-sm text-foreground">Comparativo de Preço Unitário por Fornecedor — P13</p>
          <p className="text-xs text-muted-foreground mt-0.5">Identifique quem oferece as melhores margens de negociação</p>
        </div>

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
                return r ? `${r.fullName} · ${r.qty.toLocaleString("pt-BR")} un` : "";
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
                {["Fornecedor", "Mín", "Médio", "Máx", "Qtd", "Total", "vs. Média"].map((h) => (
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
                    <td className="px-3 py-2 text-muted-foreground">{r.qty.toLocaleString("pt-BR")}</td>
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
      </CardContent>
    </Card>
  );
}
