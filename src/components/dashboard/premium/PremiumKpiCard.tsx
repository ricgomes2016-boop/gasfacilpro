import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export type KpiTone = "primary" | "success" | "warning" | "destructive" | "info" | "accent" | "violet";

const toneMap: Record<KpiTone, { text: string; from: string; to: string; glow: string; ring: string }> = {
  primary:     { text: "text-primary",     from: "from-primary/12",     to: "to-primary/0",     glow: "bg-primary/25",     ring: "ring-primary/15" },
  success:     { text: "text-success",     from: "from-success/12",     to: "to-success/0",     glow: "bg-success/25",     ring: "ring-success/15" },
  warning:     { text: "text-warning",     from: "from-warning/15",     to: "to-warning/0",     glow: "bg-warning/25",     ring: "ring-warning/15" },
  destructive: { text: "text-destructive", from: "from-destructive/12", to: "to-destructive/0", glow: "bg-destructive/25", ring: "ring-destructive/15" },
  info:        { text: "text-info",        from: "from-info/12",        to: "to-info/0",        glow: "bg-info/25",        ring: "ring-info/15" },
  accent:      { text: "text-accent",      from: "from-accent/12",      to: "to-accent/0",      glow: "bg-accent/25",      ring: "ring-accent/15" },
  violet:      { text: "text-secondary",   from: "from-secondary/12",   to: "to-secondary/0",   glow: "bg-secondary/25",   ring: "ring-secondary/15" },
};

interface Trend {
  value: number;          // percentage (e.g., 12.4 = +12.4%)
  label?: string;         // e.g., "vs mês anterior"
  isPositive?: boolean;   // override; otherwise inferred by sign
}

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: KpiTone;
  subtitle?: string;
  trend?: Trend;
  /** Values for the mini sparkline (last N points). If omitted, sparkline hidden. */
  sparkline?: number[];
  className?: string;
  onClick?: () => void;
}

/**
 * Premium KPI card — nível HERO da escala de elevação.
 * - Gradiente sutil no fundo (tone-aware)
 * - Ícone com halo/glow
 * - Números em tabular-nums
 * - Trend vs período anterior com seta colorida
 * - Mini sparkline opcional (recharts Area)
 */
export function PremiumKpiCard({
  label, value, icon: Icon, tone = "primary", subtitle, trend, sparkline, className, onClick,
}: Props) {
  const t = toneMap[tone];
  const isPos = trend ? trend.isPositive ?? trend.value >= 0 : undefined;
  const TrendIcon = trend ? (trend.value === 0 ? Minus : isPos ? ArrowUpRight : ArrowDownRight) : null;

  const spark = sparkline && sparkline.length > 1
    ? sparkline.map((v, i) => ({ i, v }))
    : null;

  const gradientId = `spark-${tone}-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative isolate flex min-h-[128px] flex-col overflow-hidden rounded-[var(--radius)] border border-border/60 bg-card p-3 sm:p-5",
        "shadow-[var(--elev-2)] ring-1 ring-inset transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[var(--elev-3)]",
        t.ring,
        onClick && "cursor-pointer",
        className,
      )}
    >
      {/* Gradient wash */}
      <div className={cn("pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br opacity-70", t.from, t.to)} />
      {/* Glow blob */}
      <div className={cn("pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-60", t.glow)} />

      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p title={label} className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
            {label}
          </p>
          <p title={value}
            className="mt-1 whitespace-nowrap text-[1.05rem] font-semibold leading-tight tracking-tight tabular-nums text-foreground sm:mt-1.5 sm:text-[1.45rem]">
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">{subtitle}</p>
          )}
        </div>

        {/* Icon with halo */}
        <div className="relative shrink-0">
          <span className={cn("absolute inset-0 -m-1 rounded-full blur-md opacity-60", t.glow)} />
          <div className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-card/80 backdrop-blur ring-1 ring-inset sm:h-10 sm:w-10",
            t.ring, t.text,
          )}>
            <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.2} />
          </div>
        </div>
      </div>


      {/* Trend + sparkline row */}
      {(trend || spark) && (
        <div className="relative mt-3 flex items-end justify-between gap-3">
          {trend ? (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              trend.value === 0
                ? "bg-muted text-muted-foreground"
                : isPos
                  ? "bg-success/12 text-success"
                  : "bg-destructive/12 text-destructive",
            )}>
              {TrendIcon && <TrendIcon className="h-3 w-3" strokeWidth={2.5} />}
              {trend.value === 0 ? "0%" : `${isPos ? "+" : ""}${trend.value.toFixed(1)}%`}
              {trend.label && <span className="ml-1 hidden font-normal text-muted-foreground sm:inline">{trend.label}</span>}
            </span>
          ) : <span />}

          {spark && (
            <div className="h-10 w-24 shrink-0 opacity-90">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    fill={`url(#${gradientId})`}
                    isAnimationActive={false}
                    className={t.text}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
