import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/transp-utils";

interface Props {
  compras: any[];
}

export function ComprasAnaliseGLP({ compras }: Props) {
  const stats = useMemo(() => {
    const totalGasto = compras.reduce((s, c) => s + Number(c.custo_total || 0), 0);
    const qtdNotas = compras.length;
    const totalProdutos = compras.reduce(
      (s, c) => s + Number(c.qtd_p13 || 0) + Number(c.qtd_p20 || 0) + Number(c.qtd_p45 || 0) + Number(c.qtd_agua || 0),
      0
    );
    let somaCusto = 0, somaQtd = 0;
    compras.forEach((c) => {
      const q = Number(c.qtd_p13 || 0);
      somaCusto += Number(c.custo_unit_p13 || 0) * q;
      somaQtd += q;
    });
    const precoMedioP13 = somaQtd > 0 ? somaCusto / somaQtd : 0;
    return { totalGasto, qtdNotas, totalProdutos, precoMedioP13 };
  }, [compras]);

  const evolucao = useMemo(() => {
    const map = new Map<string, { mes: string; somaP13: number; qtdP13: number; somaP20: number; qtdP20: number; somaP45: number; qtdP45: number }>();
    compras.forEach((c) => {
      const mes = c.mes_referencia || String(c.data).slice(0, 7);
      const r = map.get(mes) || { mes, somaP13: 0, qtdP13: 0, somaP20: 0, qtdP20: 0, somaP45: 0, qtdP45: 0 };
      r.somaP13 += Number(c.custo_unit_p13 || 0) * Number(c.qtd_p13 || 0);
      r.qtdP13 += Number(c.qtd_p13 || 0);
      r.somaP20 += Number(c.custo_unit_p20 || 0) * Number(c.qtd_p20 || 0);
      r.qtdP20 += Number(c.qtd_p20 || 0);
      r.somaP45 += Number(c.custo_unit_p45 || 0) * Number(c.qtd_p45 || 0);
      r.qtdP45 += Number(c.qtd_p45 || 0);
      map.set(mes, r);
    });
    return Array.from(map.values())
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        mes: r.mes,
        P13: r.qtdP13 > 0 ? +(r.somaP13 / r.qtdP13).toFixed(2) : 0,
        P20: r.qtdP20 > 0 ? +(r.somaP20 / r.qtdP20).toFixed(2) : 0,
        P45: r.qtdP45 > 0 ? +(r.somaP45 / r.qtdP45).toFixed(2) : 0,
      }));
  }, [compras]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/40"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Gasto Total</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(stats.totalGasto)}</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Qtd. Notas</p>
          <p className="text-xl font-bold text-foreground">{stats.qtdNotas}</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Qtd. Produtos</p>
          <p className="text-xl font-bold text-foreground">{stats.totalProdutos.toLocaleString("pt-BR")}</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Preço Médio P13</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.precoMedioP13)}</p>
        </CardContent></Card>
      </div>

      <Card className="border-border/40">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Evolução do Preço Médio (R$/un)</p>
          {evolucao.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sem dados suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => formatCurrency(Number(v))}
                />
                <Legend />
                <Line type="monotone" dataKey="P13" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="P20" stroke="hsl(var(--chart-2, 142 76% 36%))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="P45" stroke="hsl(var(--chart-3, 38 92% 50%))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
