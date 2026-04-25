import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrasiliaDate, getBrasiliaStartOfDay, getBrasiliaEndOfDay } from "@/lib/utils";

export function DailySalesGoal() {
  const { unidadeAtual } = useUnidade();
  const today = getBrasiliaDate();

  const { data, isLoading } = useQuery({
    queryKey: ["daily-goal", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      // Get active daily goal
      let metaQuery = supabase
        .from("metas")
        .select("valor_objetivo, valor_atual")
        .eq("tipo", "vendas")
        .eq("status", "ativa")
        .limit(1);

      if (unidadeAtual?.id) {
        metaQuery = metaQuery.eq("unidade_id", unidadeAtual.id);
      }

      const { data: metas } = await metaQuery;
      const meta = metas?.[0];

      // Get today's sales
      const dayStart = getBrasiliaStartOfDay(today);
      const dayEnd = getBrasiliaEndOfDay(today);

      let salesQuery = supabase
        .from("pedidos")
        .select("valor_total")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .neq("status", "cancelado");

      if (unidadeAtual?.id) {
        salesQuery = salesQuery.eq("unidade_id", unidadeAtual.id);
      }

      const { data: pedidos } = await salesQuery;
      const vendasHoje = (pedidos || []).reduce(
        (sum: number, p: any) => sum + (Number(p.valor_total) || 0),
        0
      );

      const objetivo = meta?.valor_objetivo || 5000; // fallback
      return { vendasHoje, objetivo };
    },
  });

  if (isLoading) return <Skeleton className="h-[120px] w-full" />;

  const { vendasHoje = 0, objetivo = 5000 } = data || {};
  const pct = Math.min((vendasHoje / objetivo) * 100, 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" /> Meta Diária
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            R$ {vendasHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="font-medium">
            R$ {objetivo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <Progress value={pct} className="h-3" />
        <p className="text-center text-sm font-semibold">
          {pct.toFixed(0)}% atingido
        </p>
      </CardContent>
    </Card>
  );
}
