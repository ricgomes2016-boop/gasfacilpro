import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, RefreshCw, Phone, MessageSquare, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecompraAlert {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  dias_sem_comprar: number;
  intervalo_medio_dias: number;
  atraso_dias: number;
  previsao_recompra: string;
  valor_medio: number;
  prioridade: "alta" | "media" | "baixa";
}

const prioridadeCores: Record<string, string> = {
  alta: "border-l-destructive bg-destructive/5",
  media: "border-l-amber-500 bg-warning/5",
  baixa: "border-l-primary bg-primary/5",
};

const prioridadeBadge: Record<string, "destructive" | "secondary" | "outline"> = {
  alta: "destructive",
  media: "secondary",
  baixa: "outline",
};

export function RecompraAlerts() {
  const { unidadeAtual } = useUnidade();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["recompra-alerts", unidadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("recompra-alerts", {
        body: { unidade_id: unidadeAtual?.id || null },
      });
      if (error) throw error;
      return (data?.alerts || []) as RecompraAlert[];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const alerts = data || [];

  const openWhatsApp = (telefone: string, nome: string) => {
    const phone = telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${nome}! Tudo bem? Notamos que já faz um tempinho desde seu último pedido de gás. Gostaria de fazer um novo pedido? 😊🔥`);
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  return (
    <Card>
      <CardHeader className="section-header-stock pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="section-header-title">
            <span className="section-header-icon-frame h-8 w-8"><Bell className="h-4 w-4" /></span>
            Alertas de Recompra
          </CardTitle>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && (
              <Badge variant="secondary" className="text-xs">{alerts.length} clientes</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-warning-foreground hover:bg-warning-foreground/10 hover:text-warning-foreground" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum alerta de recompra no momento</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border-l-4 p-3 transition-colors",
                    prioridadeCores[alert.prioridade]
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{alert.cliente_nome}</p>
                        <Badge variant={prioridadeBadge[alert.prioridade]} className="text-[10px] px-1.5">
                          {alert.prioridade === "alta" ? "Urgente" : alert.prioridade === "media" ? "Atenção" : "Em breve"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {alert.dias_sem_comprar}d sem comprar
                        </span>
                        <span>Ciclo: ~{alert.intervalo_medio_dias}d</span>
                        <span>Ticket: R$ {alert.valor_medio.toFixed(0)}</span>
                      </div>
                    </div>
                    {alert.telefone && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => window.open(`tel:${alert.telefone}`, "_self")}
                          title="Ligar"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => openWhatsApp(alert.telefone!, alert.cliente_nome)}
                          title="WhatsApp"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
