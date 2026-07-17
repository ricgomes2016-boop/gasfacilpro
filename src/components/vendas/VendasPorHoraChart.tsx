import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, eachDayOfInterval, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { ChartCardSkeleton } from "@/components/dashboard/premium/skeletons";
import { chartGridProps, chartAxisTick, fmtBRL, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";

interface Pedido {
  id: string;
  created_at: string;
  valor_total: number | null;
  status: string | null;
}

interface VendasPorHoraChartProps {
  pedidos: Pedido[];
  isLoading: boolean;
  periodo?: "hoje" | "semana" | "mes";
}

export function VendasPorHoraChart({ pedidos, isLoading, periodo = "hoje" }: VendasPorHoraChartProps) {
  const chartData = useMemo(() => {
    const valid = pedidos.filter((p) => p.status !== "cancelado");

    if (periodo === "hoje") {
      // Group by hour
      const horas: Record<number, { label: string; vendas: number; qtd: number }> = {};
      for (let h = 6; h <= 22; h++) {
        horas[h] = { label: `${h.toString().padStart(2, "0")}h`, vendas: 0, qtd: 0 };
      }
      valid.forEach((p) => {
        const h = new Date(p.created_at).getHours();
        if (horas[h]) {
          horas[h].vendas += p.valor_total || 0;
          horas[h].qtd += 1;
        }
      });
      return Object.values(horas);
    } else {
      // Group by day
      const today = new Date();
      const start = periodo === "semana" ? startOfWeek(today, { weekStartsOn: 0 }) : startOfMonth(today);
      const days = eachDayOfInterval({ start, end: endOfDay(today) });
      
      const dayMap = new Map<string, { label: string; vendas: number; qtd: number }>();
      days.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        dayMap.set(key, { label: format(d, "dd/MM", { locale: ptBR }), vendas: 0, qtd: 0 });
      });

      valid.forEach((p) => {
        const key = format(new Date(p.created_at), "yyyy-MM-dd");
        const entry = dayMap.get(key);
        if (entry) {
          entry.vendas += p.valor_total || 0;
          entry.qtd += 1;
        }
      });

      return Array.from(dayMap.values());
    }
  }, [pedidos, periodo]);

  const title = periodo === "hoje" ? "Vendas por Hora" : periodo === "semana" ? "Vendas por Dia (Semana)" : "Vendas por Dia (Mês)";

  return (
    <Card>
      <CardHeader className="section-header-finance">
        <CardTitle className="section-header-title">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartCardSkeleton height={220} title={false} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" tick={chartAxisTick} tickLine={false} axisLine={false} interval={periodo === "mes" ? 2 : 0} />
              <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={fmtBRLcompact} width={55} />
              <Tooltip
                content={<ChartTooltip formatter={(v) => fmtBRL(v)} />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
