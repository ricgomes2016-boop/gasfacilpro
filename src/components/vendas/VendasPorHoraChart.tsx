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
          <div className="flex items-center justify-center h-[220px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={periodo === "mes" ? 2 : 0} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={55} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Vendas"]}
                contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
