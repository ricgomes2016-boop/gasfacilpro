import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, RefreshCw, Package, Truck, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Previsao {
  emoji: string;
  titulo: string;
  descricao: string;
  tipo: "estoque" | "logistica" | "vendas";
}

export function PrevisaoDemandaWidget() {
  const { unidadeAtual } = useUnidade();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["previsao-demanda", unidadeAtual?.id],
    queryFn: async () => {
      const { data: fnData, error } = await supabase.functions.invoke("previsao-demanda", {
        body: { unidade_id: unidadeAtual?.id || null },
      });
      if (error) {
        toast({ title: "Erro ao gerar previsão", variant: "destructive" });
        throw error;
      }
      if (fnData?.error) {
        if (fnData.error.includes("Rate limit")) toast({ title: "Limite de requisições atingido", description: "Tente novamente em alguns segundos.", variant: "destructive" });
        else if (fnData.error.includes("Créditos")) toast({ title: "Créditos esgotados", variant: "destructive" });
        else toast({ title: "Erro", description: fnData.error, variant: "destructive" });
        throw new Error(fnData.error);
      }
      return (fnData?.previsoes || []) as Previsao[];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const previsoes = data || [];

  const tipoIcones: Record<string, typeof Package> = {
    estoque: Package,
    logistica: Truck,
    vendas: TrendingUp,
  };

  const tipoCores: Record<string, string> = {
    estoque: "border-l-primary bg-primary/5",
    logistica: "border-l-chart-3 bg-success/5",
    vendas: "border-l-chart-4 bg-warning/5",
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            Previsão de Demanda (IA)
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
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
        ) : previsoes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma previsão disponível</p>
            <Button variant="link" size="sm" onClick={() => refetch()}>Gerar previsão</Button>
          </div>
        ) : (
          previsoes.map((p, i) => {
            const Icon = tipoIcones[p.tipo] || TrendingUp;
            return (
              <div key={i} className={cn("rounded-lg border-l-4 p-3 transition-colors", tipoCores[p.tipo] || tipoCores.vendas)}>
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{p.titulo}</p>
                      <Badge variant="outline" className="text-[9px]">{p.tipo}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>
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
