import { cn } from "@/lib/utils";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface MoneyTextProps {
  value: number | null | undefined;
  /** Colore automaticamente positivo/negativo. */
  colored?: boolean;
  /** Força um tom semântico. */
  tone?: "positive" | "negative" | "muted" | "default";
  /** Tamanho tipográfico. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "text-[12px]",
  md: "text-sm",
  lg: "text-lg font-semibold",
  xl: "text-2xl font-semibold tracking-tight",
} as const;

/** Exibição canônica de valores monetários (sempre tabular-nums e pt-BR). */
export function MoneyText({ value, colored, tone, size = "md", className }: MoneyTextProps) {
  const v = Number(value ?? 0);
  const resolved = tone ?? (colored ? (v < 0 ? "negative" : v > 0 ? "positive" : "muted") : "default");

  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        sizeClasses[size],
        resolved === "positive" && "text-success",
        resolved === "negative" && "text-destructive",
        resolved === "muted" && "text-muted-foreground",
        resolved === "default" && "text-foreground",
        className,
      )}
    >
      {brl.format(v)}
    </span>
  );
}

export function formatMoney(value: number | null | undefined) {
  return brl.format(Number(value ?? 0));
}
