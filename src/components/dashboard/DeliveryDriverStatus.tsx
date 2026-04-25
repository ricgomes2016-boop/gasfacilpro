import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Truck, CheckCircle2, Clock, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function DeliveryDriverStatus() {
  const { unidadeAtual } = useUnidade();

  const { data, isLoading } = useQuery({
    queryKey: ["driver-status", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      let query = supabase
        .from("entregadores")
        .select("id, nome, status")
        .eq("ativo", true);

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data } = await query;
      const drivers = data || [];

      return {
        total: drivers.length,
        emRota: drivers.filter((d: any) => d.status === "em_rota").length,
        disponivel: drivers.filter((d: any) => d.status === "disponivel" || d.status === "ativo").length,
        offline: drivers.filter((d: any) => !d.status || d.status === "offline" || d.status === "inativo").length,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-[120px] w-full" />;

  const items = [
    { label: "Em Rota", value: data?.emRota ?? 0, icon: Truck, color: "text-warning" },
    { label: "Disponíveis", value: data?.disponivel ?? 0, icon: CheckCircle2, color: "text-success" },
    { label: "Offline", value: data?.offline ?? 0, icon: WifiOff, color: "text-muted-foreground" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" /> Entregadores ({data?.total ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
