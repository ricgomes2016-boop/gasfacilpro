import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Truck, CheckCircle, XCircle, CalendarClock } from "lucide-react";
import type { ItemVenda } from "./ProductSearch";
import type { Pagamento } from "./PaymentSection";

interface OrderSummaryProps {
  itens: ItemVenda[];
  pagamentos: Pagamento[];
  entregadorNome: string | null;
  canalVenda: string;
  onFinalizar: () => void;
  onCancelar: () => void;
  onAgendar?: () => void;
  isLoading?: boolean;
}

export function OrderSummary({
  itens,
  pagamentos,
  entregadorNome,
  canalVenda,
  onFinalizar,
  onCancelar,
  onAgendar,
  isLoading = false,
}: OrderSummaryProps) {
  const subtotal = itens.reduce((acc, item) => acc + item.total, 0);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const desconto = 0; // Pode ser expandido no futuro
  const total = subtotal - desconto;
  const pagamentoCompleto = totalPago >= total && total > 0;

  return (
    <Card className="venda-card w-full min-w-0 max-w-full overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/12 text-primary">
            <ShoppingCart className="h-5 w-5 shrink-0" />
          </span>
          <span className="truncate">Resumo da Venda</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 w-full min-w-0 p-4">
        {/* Canal de venda */}
        <div className="flex items-center justify-between gap-2 text-sm w-full min-w-0">
          <span className="text-muted-foreground shrink-0">Canal</span>
          <Badge variant="outline" className="truncate max-w-[60%]">{canalVenda}</Badge>
        </div>

        <Separator />

        {/* Itens resumidos */}
        <div className="space-y-2 w-full min-w-0">
          {itens.map((item) => (
            <div key={item.id} className="flex justify-between gap-2 text-sm w-full min-w-0">
              <span className="text-muted-foreground truncate min-w-0 flex-1" title={`${item.quantidade}x ${item.nome}`}>
                {item.quantidade}x {item.nome}
              </span>
              <span className="shrink-0">R$ {item.total.toFixed(2)}</span>
            </div>
          ))}
          {itens.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhum item adicionado
            </p>
          )}
        </div>

        <Separator />

        {/* Totais */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Desconto</span>
              <span>- R$ {desconto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-3 border-t">
            <span>Total</span>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Pagamento */}
        {pagamentos.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Pagamentos
              </p>
              {pagamentos.map((p) => (
                <div key={p.id} className="flex justify-between gap-2 text-sm w-full min-w-0">
                  <span className="capitalize truncate min-w-0 flex-1">{p.forma.replace("_", " ")}</span>
                  <span className="shrink-0">R$ {p.valor.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-1">
                <span>Total Pago</span>
                <span className={pagamentoCompleto ? "text-success" : "text-destructive"}>
                  R$ {totalPago.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Entregador */}
        {entregadorNome && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-sm w-full min-w-0">
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">Entregador:</span>
              <span className="font-medium text-success truncate min-w-0" title={entregadorNome}>{entregadorNome}</span>
            </div>
          </>
        )}

        {/* Ações */}
        <div className="space-y-2 pt-3">
          <Button
            className="w-full h-11 shadow-sm shadow-primary/20"
            size="lg"
            onClick={onFinalizar}
            disabled={!pagamentoCompleto || itens.length === 0 || isLoading}
          >
            {isLoading ? (
              "Processando..."
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Finalizar Venda
              </>
            )}
          </Button>
          {onAgendar && (
            <Button
              variant="secondary"
              className="w-full h-10"
              onClick={onAgendar}
              disabled={itens.length === 0 || isLoading}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Agendar Entrega
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full h-10"
            onClick={onCancelar}
            disabled={isLoading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
