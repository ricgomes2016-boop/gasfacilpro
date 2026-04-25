import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

interface Insight {
  emoji: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
}

const prioridadeCores: Record<string, string> = {
  alta: "border-l-destructive bg-destructive/5",
  media: "border-l-amber-500 bg-amber-500/5",
  baixa: "border-l-primary bg-primary/5",
};

const prioridadeIcones: Record<string, typeof AlertTriangle> = {
  alta: AlertTriangle,
  media: TrendingUp,
  baixa: Lightbulb,
};

export function AiInsightsWidget() {
  const { unidadeAtual } = useUnidade();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-insights", unidadeAtual?.id],
    queryFn: async () => {
      const { data: fnData, error } = await supabase.functions.invoke("dashboard-insights", {
        body: { unidade_id: unidadeAtual?.id || null },
      });

      if (error) {
        toast({
          title: "Erro ao gerar insights",
          description: "Tente novamente em alguns segundos.",
          variant: "destructive",
        });
        throw error;
      }

      if (fnData?.error) {
        toast({
          title: "Erro",
          description: fnData.error,
          variant: "destructive",
        });
        throw new Error(fnData.error);
      }

      return (fnData?.insights || []) as Insight[];
    },
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const insights = data || [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights IA
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : insights.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum insight disponível</p>
            <Button variant="link" size="sm" onClick={() => refetch()}>
              Gerar insights
            </Button>
          </div>
        ) : (
          insights.map((insight, i) => {
            const PrioIcon = prioridadeIcones[insight.prioridade] || Lightbulb;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border-l-4 p-3 transition-colors",
                  prioridadeCores[insight.prioridade] || prioridadeCores.baixa
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{insight.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{insight.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.descricao}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
