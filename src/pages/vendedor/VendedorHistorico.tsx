import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";

interface Pedido {
  id: string;
  created_at: string;
  status: string;
  valor_total: number;
  tipo_venda: string | null;
  forma_pagamento: string | null;
  clientes?: { nome: string } | null;
}

export default function VendedorHistorico() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const formaLabel = useFormaPagamentoLabel();

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("pedidos")
        .select("id, created_at, status, valor_total, tipo_venda, forma_pagamento, clientes(nome)")
        .eq("vendedor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setPedidos((data as any) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <VendedorLayout title="Meu Histórico">
      <div className="p-4 space-y-3">
        {loading && <p className="text-center text-muted-foreground">Carregando...</p>}
        {!loading && pedidos.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma venda ainda</p>
        )}
        {pedidos.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.clientes?.nome || "Balcão"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {p.tipo_venda || "venda"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {p.status}
                    </Badge>
                    {p.forma_pagamento && (
                      <Badge variant="outline" className="text-[10px] max-w-[140px] truncate" title={formaLabel(p.forma_pagamento)}>
                        {formaLabel(p.forma_pagamento)}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="font-bold text-primary whitespace-nowrap">
                  R$ {Number(p.valor_total).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </VendedorLayout>
  );
}
