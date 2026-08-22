import { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiTone =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "destructive"
  | "secondary"
  | "accent"
  | "violet"
  | "neutral";

const toneClasses: Record<KpiTone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  secondary: "bg-secondary/15 text-secondary",
  accent: "bg-accent/15 text-accent",
  violet: "bg-secondary/15 text-secondary",
  neutral: "bg-muted text-muted-foreground",
};

export interface KpiTrend {
  /** Variação percentual (ex.: 12.4 = +12,4%). */
  value: number;
  label?: string;
  isPositive?: boolean;
}

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: KpiTone;
  /** Texto auxiliar abaixo do valor. */
  hint?: string;
  trend?: KpiTrend;
  onClick?: () => void;
  footer?: ReactNode;
  className?: string;
}

/**
 * Card de KPI canônico — única implementação do sistema.
 * Um só nível de elevação, sem card dentro de card.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  trend,
  onClick,
  footer,
  className,
}: KpiCardProps) {
  const isPos = trend ? (trend.isPositive ?? trend.value >= 0) : undefined;
  const TrendIcon = trend ? (trend.value === 0 ? Minus : isPos ? ArrowUpRight : ArrowDownRight) : null;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "flex w-full min-w-0 flex-col justify-between gap-3 rounded-card border border-border/70 bg-card p-3 shadow-[var(--elev-1)] transition-colors sm:p-4",
        onClick && "cursor-pointer hover:border-primary/40 hover:bg-muted/30",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-control sm:h-10 sm:w-10",
              toneClasses[tone],
            )}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p className="mt-0.5 break-words text-[1.1rem] font-semibold leading-tight tracking-tight tabular-nums text-foreground sm:text-2xl">
            {value}
          </p>
          {hint && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">{hint}</p>}
        </div>
      </div>

      {(trend || footer) && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                trend.value === 0
                  ? "bg-muted text-muted-foreground"
                  : isPos
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {TrendIcon && <TrendIcon className="h-3 w-3" strokeWidth={2.5} />}
              {trend.value === 0 ? "0%" : `${isPos ? "+" : ""}${trend.value.toFixed(1)}%`}
              {trend.label && <span className="ml-1 font-normal text-muted-foreground">{trend.label}</span>}
            </span>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}

export interface KpiRowProps {
  children: ReactNode;
  /** Número de colunas no desktop. */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

const columnClasses: Record<NonNullable<KpiRowProps["columns"]>, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-5",
};

/** Grade padrão para linhas de KPI. */
export function KpiRow({ children, columns = 4, className }: KpiRowProps) {
  return <div className={cn("grid w-full min-w-0 gap-3", columnClasses[columns], className)}>{children}</div>;
}
