import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";
import { VendaSectionHeader } from "./VendaSectionHeader";

interface Pedido {
  id: string;
  created_at: string;
  valor_total: number | null;
  forma_pagamento: string | null;
  status: string | null;
}

interface CustomerHistoryProps {
  clienteId: string | null;
}

export function CustomerHistory({ clienteId }: CustomerHistoryProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setPedidos([]);
      return;
    }

    const fetchPedidos = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("id, created_at, valor_total, forma_pagamento, status")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!error && data) {
          setPedidos(data);
        }
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
  }, [clienteId]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "entregue":
        return <Badge variant="default">Entregue</Badge>;
      case "em_rota":
        return <Badge variant="secondary">Em Rota</Badge>;
      case "pendente":
        return <Badge variant="outline">Pendente</Badge>;
      case "cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  return (
    <Card className="venda-card w-full min-w-0 max-w-full">
      <VendaSectionHeader title="Histórico do Cliente" icon={<History className="h-5 w-5 shrink-0" />} tone="info" className="pb-3" />
      <CardContent className="w-full min-w-0">
        {!clienteId ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Selecione um cliente para ver o histórico</p>
          </div>
        ) : loading ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Carregando...</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto w-full min-w-0 max-w-full">
            <Table className="w-full min-w-0">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-2 sm:px-4">Data</TableHead>
                  <TableHead className="px-2 sm:px-4 hidden sm:table-cell">Pedido</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Valor</TableHead>
                  <TableHead className="px-2 sm:px-4 hidden md:table-cell">Pagamento</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="text-sm px-2 sm:px-4 whitespace-nowrap">
                      {format(new Date(pedido.created_at), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground px-2 sm:px-4 hidden sm:table-cell">
                      #{pedido.id.slice(0, 6)}
                    </TableCell>
                    <TableCell className="text-right font-medium px-2 sm:px-4 whitespace-nowrap">
                      R$ {(pedido.valor_total || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                        {pedido.forma_pagamento || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 sm:px-4">{getStatusBadge(pedido.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
