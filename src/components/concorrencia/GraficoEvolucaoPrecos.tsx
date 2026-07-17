import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { parseLocalDate } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { chartColor, chartGridProps, chartAxisTick, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";

interface Props {
  registros: any[];
  nossosPrecos: Record<string, { portaria: number; telefone: number; unico: number }>;
}

export function GraficoEvolucaoPrecos({ registros, nossosPrecos }: Props) {
  const chartData = useMemo(() => {
    if (registros.length === 0) return [];

    // Group by date
    const byDate: Record<string, Record<string, number[]>> = {};
    registros.forEach((r: any) => {
      const date = r.data;
      if (!byDate[date]) byDate[date] = {};
      const key = `${r.concorrente_nome}`;
      if (!byDate[date][key]) byDate[date][key] = [];
      byDate[date][key].push(Number(r.preco));
    });

    const concorrentes = [...new Set(registros.map((r: any) => r.concorrente_nome))];

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, concData]) => {
        const point: any = {
          data: parseLocalDate(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        };
        concorrentes.forEach(c => {
          if (concData[c]) {
            point[c] = Math.round(concData[c].reduce((a, b) => a + b, 0) / concData[c].length * 100) / 100;
          }
        });
        return point;
      });
  }, [registros]);

  const concorrentes = useMemo(() => [...new Set(registros.map((r: any) => r.concorrente_nome))], [registros]);

  if (chartData.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Registre preços em datas diferentes para visualizar a evolução
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Evolução de Preços
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="data" tick={chartAxisTick} tickLine={false} axisLine={false} />
            <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={fmtBRLcompact} />
            <Tooltip
              content={<ChartTooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {concorrentes.map((c, i) => (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                stroke={chartColor(i)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
