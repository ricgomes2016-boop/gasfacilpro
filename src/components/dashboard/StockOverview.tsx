import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Skeleton } from "@/components/ui/skeleton";

export function StockOverview() {
  const { unidadeAtual } = useUnidade();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["stock-overview", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("id, nome, estoque, categoria")
        .eq("ativo", true)
        .order("nome");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Estimate max as 100 for display purposes
  const MAX_STOCK = 100;

  return (
    <Card className="h-full w-full min-w-0 border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Visão do Estoque</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto cadastrado</p>
        ) : (
          <div className="space-y-4">
            {products.slice(0, 6).map((item) => {
              const current = item.estoque ?? 0;
              const percentage = Math.min((current / MAX_STOCK) * 100, 100);
              const isLow = current < 10;

              return (
                <div key={item.id} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {item.nome}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        isLow ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {current} un
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
