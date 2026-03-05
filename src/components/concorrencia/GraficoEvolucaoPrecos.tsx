import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { parseLocalDate } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Props {
  registros: any[];
  nossosPrecos: Record<string, { portaria: number; telefone: number; unico: number }>;
}

const COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

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
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="data" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
            <Tooltip
              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, ""]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {concorrentes.map((c, i) => (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
