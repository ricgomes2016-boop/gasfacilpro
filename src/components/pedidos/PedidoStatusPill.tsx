import { Clock, Truck, CheckCircle, XCircle, CreditCard, Loader2, Ban, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const config: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pendente:     { label: "Pendente",   cls: "bg-warning/15 text-warning border-warning/30", Icon: Clock },
  novo:         { label: "Novo",       cls: "bg-primary/15 text-primary border-primary/30", Icon: Sparkles },
  em_rota:      { label: "Em rota",    cls: "bg-info/15 text-info border-info/30",          Icon: Truck },
  entregue:     { label: "Entregue",   cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle },
  finalizado:   { label: "Finalizado", cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle },
  cancelado:    { label: "Cancelado",  cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
  agendado:     { label: "Agendado",   cls: "bg-info/15 text-info border-info/30",          Icon: Calendar },
  aguardando_pagamento_cartao: { label: "Aguard. Cartão", cls: "bg-warning/15 text-warning border-warning/30", Icon: CreditCard },
  pagamento_em_processamento:  { label: "Processando",    cls: "bg-info/15 text-info border-info/30",          Icon: Loader2 },
  pago_cartao:                 { label: "Pago (Cartão)",  cls: "bg-success/15 text-success border-success/30", Icon: CreditCard },
  pagamento_negado:            { label: "Pgto Negado",    cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: Ban },
};

export function PedidoStatusPill({ status, size = "sm", className }: { status: string; size?: "sm" | "xs"; className?: string }) {
  const c = config[status] || config.pendente;
  const Icon = c.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        c.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{c.label}</span>
    </span>
  );
}
