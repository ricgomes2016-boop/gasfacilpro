import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  entregue: { label: "Entregue", variant: "default" as const },
  pendente: { label: "Pendente", variant: "secondary" as const },
  em_rota: { label: "Em Rota", variant: "outline" as const },
  cancelado: { label: "Cancelado", variant: "destructive" as const },
};

export function RecentSales() {
  const { unidadeAtual } = useUnidade();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["recent-sales", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      // Início do dia no horário de Brasília (UTC-3)
      const now = new Date();
      const brasiliaOffset = -3 * 60;
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const brasiliaDate = new Date(utcMs + brasiliaOffset * 60000);
      const todayStr = brasiliaDate.toISOString().split("T")[0];
      const todayStartUTC = new Date(`${todayStr}T03:00:00Z`).toISOString(); // 00:00 BRT = 03:00 UTC

      let query = supabase
        .from("pedidos")
        .select(`*, clientes (nome), pedido_itens (quantidade, produtos (nome))`)
        .gte("created_at", todayStartUTC)
        .order("created_at", { ascending: false });

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p) => {
        const produtos = (p.pedido_itens || [])
          .map((i: any) => `${i.quantidade}x ${i.produtos?.nome || "Produto"}`)
          .join(", ") || "Sem itens";

        const status = p.status as keyof typeof statusConfig;

        return {
          id: p.id,
          customer: p.clientes?.nome || "Cliente",
          produtos,
          total: Number(p.valor_total) || 0,
          status: statusConfig[status] ? status : "pendente",
          time: format(new Date(p.created_at), "HH:mm"),
        };
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : sales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda encontrada</p>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{sale.customer}</p>
                  <p className="text-sm text-muted-foreground">{sale.produtos}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={statusConfig[sale.status].variant}>
                    {statusConfig[sale.status].label}
                  </Badge>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      R$ {sale.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{sale.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
