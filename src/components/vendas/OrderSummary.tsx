import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Truck, CheckCircle, XCircle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemVenda } from "./ProductSearch";
import type { Pagamento } from "./PaymentSection";
import { VendaSectionHeader } from "./VendaSectionHeader";


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
      <VendaSectionHeader title="Resumo da Venda" icon={<ShoppingCart className="h-5 w-5 shrink-0" />} tone="critical" />
      <CardContent className="grid w-full min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3 min-w-0">
        {/* Canal de venda */}
        <div className="flex items-center justify-between gap-2 text-sm w-full min-w-0">
          <span className="text-muted-foreground shrink-0">Canal</span>
          <Badge variant="outline" className="truncate max-w-[60%] border-primary/40 bg-primary/10 text-primary">{canalVenda}</Badge>
        </div>

        <Separator />

        {/* Itens resumidos */}
        <div className="space-y-2 w-full min-w-0">
          {itens.map((item) => (
            <div key={item.id} className="flex justify-between gap-2 text-sm w-full min-w-0">
            <span className="text-foreground/80 truncate min-w-0 flex-1" title={`${item.quantidade}x ${item.nome}`}>
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
            <span className="tabular-nums">R$ {subtotal.toFixed(2)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Desconto</span>
              <span className="tabular-nums">- R$ {desconto.toFixed(2)}</span>
            </div>
          )}
          <div className="relative mt-2 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-[0_12px_30px_-14px_hsl(var(--primary)/0.55)]">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="relative flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/80">Total</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums truncate">R$ {total.toFixed(2)}</p>
              </div>
              {pagamentos.length > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/70">Pago</p>
                  <p className={cn(
                    "text-sm font-bold tabular-nums",
                    pagamentoCompleto ? "text-primary-foreground" : "text-primary-foreground/70"
                  )}>R$ {totalPago.toFixed(2)}</p>
                </div>
              )}
            </div>
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
        </div>

        {/* Ações */}
        <div className="space-y-2 rounded-2xl border border-border/50 bg-card/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:self-start">
          <Button
            className="w-full h-12 rounded-xl shadow-md shadow-primary/25"
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
              className="w-full h-10 rounded-xl"
              onClick={onAgendar}
              disabled={itens.length === 0 || isLoading}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Agendar Entrega
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl"
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
