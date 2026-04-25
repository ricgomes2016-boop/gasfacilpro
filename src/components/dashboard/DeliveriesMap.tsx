import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfDay, endOfDay } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const statusIcons: Record<string, any> = {
  entregue: CheckCircle,
  em_rota: Clock,
  pendente: MapPin,
  cancelado: XCircle,
};

const statusColors: Record<string, string> = {
  entregue: "text-success",
  em_rota: "text-warning",
  pendente: "text-muted-foreground",
  cancelado: "text-destructive",
};

export function DeliveriesMap() {
  const { unidadeAtual } = useUnidade();
  const today = getBrasiliaDate();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["deliveries-today", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select(`*, clientes (nome, endereco, bairro)`)
        .gte("created_at", startOfDay(today).toISOString())
        .lte("created_at", endOfDay(today).toISOString())
        .in("status", ["pendente", "em_rota", "entregue"])
        .order("created_at", { ascending: false })
        .limit(6);

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((d) => ({
        id: d.id,
        address: d.endereco_entrega || [d.clientes?.endereco, d.clientes?.bairro].filter(Boolean).join(", ") || "Endereço não informado",
        status: d.status || "pendente",
        time: format(new Date(d.created_at), "HH:mm"),
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entregas do Dia</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrega hoje</p>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery) => {
              const StatusIcon = statusIcons[delivery.status] || MapPin;
              const colorClass = statusColors[delivery.status] || "text-muted-foreground";

              return (
                <div
                  key={delivery.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <StatusIcon className={`h-5 w-5 ${colorClass}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {delivery.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Previsão: {delivery.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
