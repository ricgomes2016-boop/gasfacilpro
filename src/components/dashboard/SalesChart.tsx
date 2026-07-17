import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrasiliaDate, getBrasiliaStartOfDay, getBrasiliaEndOfDay } from "@/lib/utils";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { ChartCardSkeleton } from "@/components/dashboard/premium/skeletons";
import { chartGridProps, chartAxisTick, fmtBRL, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";

export function SalesChart() {
  const { unidadeAtual } = useUnidade();
  const today = getBrasiliaDate();

  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["sales-by-hour", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const dayStart = getBrasiliaStartOfDay(today);
      const dayEnd = getBrasiliaEndOfDay(today);

      let query = supabase
        .from("pedidos")
        .select("created_at, valor_total, status")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .neq("status", "cancelado");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data } = await query;

      // Group by hour
      const hours: Record<string, number> = {};
      for (let h = 6; h <= 22; h++) {
        hours[`${h.toString().padStart(2, "0")}h`] = 0;
      }

      (data || []).forEach((p: any) => {
        const hour = new Date(p.created_at).getHours();
        const key = `${hour.toString().padStart(2, "0")}h`;
        if (hours[key] !== undefined) {
          hours[key] += Number(p.valor_total) || 0;
        }
      });

      return Object.entries(hours).map(([hora, valor]) => ({ hora, valor }));
    },
  });

  return (
    <Card>
      <CardHeader className="section-header-finance">
        <CardTitle className="section-header-title">Vendas por Hora — {format(today, "dd/MM")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartCardSkeleton height={200} title={false} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="hora" tick={chartAxisTick} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={50} tickFormatter={fmtBRLcompact} />
              <Tooltip
                content={<ChartTooltip formatter={(v) => fmtBRL(v)} />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="valor" name="Vendas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
