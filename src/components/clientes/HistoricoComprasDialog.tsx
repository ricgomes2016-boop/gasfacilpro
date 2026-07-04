import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RotateCcw, ShoppingCart, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";

interface PedidoHist {
  id: string;
  numero_sequencial: number | null;
  created_at: string;
  valor_total: number | null;
  forma_pagamento: string | null;
  status: string | null;
  pedido_itens?: { quantidade: number; produtos: { nome: string } | null }[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
  clienteNome: string;
}

export function HistoricoComprasDialog({ open, onOpenChange, clienteId, clienteNome }: Props) {
  const [pedidos, setPedidos] = useState<PedidoHist[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const formaLabel = useFormaPagamentoLabel();

  useEffect(() => {
    if (!open || !clienteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("pedidos")
          .select("id, numero_sequencial, created_at, valor_total, forma_pagamento, status, pedido_itens(quantidade, produtos(nome))")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(20);
        setPedidos((data as any) || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, clienteId]);

  const repetir = (pedidoId: string) => {
    onOpenChange(false);
    navigate(`/vendas/nova?cliente_id=${clienteId}&repetir_pedido=${pedidoId}`);
  };

  const novaVenda = () => {
    onOpenChange(false);
    navigate(`/vendas/nova?cliente_id=${clienteId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Histórico de Compras</DialogTitle>
          <DialogDescription className="text-xs">{clienteNome}</DialogDescription>
        </DialogHeader>

        <Button onClick={novaVenda} size="sm" className="w-full sm:w-auto self-end gap-1.5">
          <ShoppingCart className="h-4 w-4" /> Nova venda em branco
        </Button>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pedidos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p, idx) => {
                const itensResumo = (p.pedido_itens || [])
                  .map((it) => `${it.quantidade}x ${it.produtos?.nome || "Produto"}`)
                  .join(", ");
                return (
                  <div key={p.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{p.numero_sequencial || p.id.slice(0, 6)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {idx === 0 && <Badge variant="default" className="text-[9px] h-4">Última</Badge>}
                          <Badge variant="outline" className="text-[9px] h-4">{p.status || "—"}</Badge>
                        </div>
                        {itensResumo && (
                          <p className="text-sm mt-1 line-clamp-2">{itensResumo}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">R$ {(p.valor_total || 0).toFixed(2)}</span>
                          {p.forma_pagamento && <span>· {p.forma_pagamento}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={idx === 0 ? "default" : "outline"}
                        className="shrink-0 gap-1.5 h-8"
                        onClick={() => repetir(p.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Repetir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
