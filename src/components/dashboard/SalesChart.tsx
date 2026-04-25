import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrasiliaDate, getBrasiliaStartOfDay, getBrasiliaEndOfDay } from "@/lib/utils";

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
      <CardHeader>
        <CardTitle className="text-base">Vendas por Hora — {format(today, "dd/MM")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="hora" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
