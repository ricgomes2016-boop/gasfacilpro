import { CreditCard, Banknote, QrCode, Ticket, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function pickIcon(forma: string) {
  const f = forma.toLowerCase();
  if (f.includes("pix")) return QrCode;
  if (f.includes("dinheiro")) return Banknote;
  if (f.includes("vale")) return Ticket;
  if (f.includes("boleto")) return FileText;
  if (f.includes("cartao") || f.includes("cartão") || f.includes("credito") || f.includes("debito") || f.includes("crédito") || f.includes("débito") || f.includes("maquin")) return CreditCard;
  return CreditCard;
}

export function PedidoPaymentPill({
  forma,
  label,
  pendente,
  className,
  onClick,
}: {
  forma: string | null | undefined;
  label: string;
  pendente?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  if (!forma) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
          "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 transition-colors",
          className,
        )}
      >
        <AlertCircle className="h-3 w-3" /> Definir pagamento
      </button>
    );
  }
  const Icon = pickIcon(forma);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium max-w-full",
        pendente
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-muted/60 text-foreground/80 hover:bg-muted",
        "transition-colors",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[120px]">{label}</span>
    </button>
  );
}
