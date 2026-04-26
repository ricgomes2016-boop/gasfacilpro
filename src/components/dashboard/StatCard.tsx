import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info";
  /** Render as translucent tile inside a colored hero (GásMais only) */
  onHero?: boolean;
  /** Render as colored modern card with gradient + animation (GásMais only) */
  colored?: boolean;
}

const variantStyles = {
  default: "border-border/70 bg-card text-card-foreground",
  primary: "border-primary bg-primary text-primary-foreground",
  success: "border-success bg-success text-success-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  info: "border-info bg-info text-info-foreground",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-foreground/20 text-primary-foreground",
  success: "bg-success-foreground/20 text-success-foreground",
  warning: "bg-warning-foreground/20 text-warning-foreground",
  info: "bg-info-foreground/20 text-info-foreground",
};

// GásMais variant: light card with tonal icon circle
const gasmaisIconTone: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-accent/10 text-accent",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  variant = "default",
  onHero = false,
  colored = false,
}: StatCardProps) {
  const { isGasmais } = useDashboardTheme();

  // Colored modern card (GásMais) — gradient + shadow + hover animation
  if (isGasmais && colored) {
    const tones: Record<NonNullable<StatCardProps["variant"]>, { bar: string; glow: string; icon: string; ring: string }> = {
      primary: {
        bar: "from-primary to-primary",
        glow: "from-primary to-primary",
        icon: "from-primary to-primary shadow-primary/30",
        ring: "shadow-primary/10",
      },
      success: {
        bar: "from-success to-success",
        glow: "from-success to-success",
        icon: "from-success to-success shadow-success/30",
        ring: "shadow-success/10",
      },
      info: {
        bar: "from-info to-info",
        glow: "from-info to-info",
        icon: "from-info to-info shadow-info/30",
        ring: "shadow-info/10",
      },
      warning: {
        bar: "from-warning to-warning",
        glow: "from-warning to-warning",
        icon: "from-warning to-warning shadow-warning/30",
        ring: "shadow-warning/10",
      },
      default: {
        bar: "from-muted to-muted",
        glow: "from-muted to-muted",
        icon: "from-muted to-muted shadow-muted/30",
        ring: "shadow-muted/10",
      },
    };
    const t = tones[variant];
    return (
      <div
        className={cn(
          "group relative flex h-full min-h-[148px] min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
          t.ring
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl bg-gradient-to-br transition-opacity duration-500 group-hover:opacity-25",
            t.glow
          )}
        />
        <div className="relative flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
            )}
            {trend && (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                  trend.isPositive
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full animate-pulse",
                    trend.isPositive ? "bg-success" : "bg-destructive"
                  )}
                />
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
              t.icon
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }


  // Hero tile (translucent on orange gradient) — GásMais inside hero
  if (isGasmais && onHero) {
    return (
      <div className="flex h-full min-h-[138px] min-w-0 flex-col justify-between rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 transition-all hover:bg-white/15">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="mt-3 min-w-0 flex-1">
          <p className="break-words text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            {value}
          </p>
        </div>
        <div className="mt-3 min-h-[40px] min-w-0">
          <p className="text-sm font-medium text-white/90 line-clamp-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-white/60 mt-0.5 line-clamp-1">{subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  if (isGasmais) {
    return (
      <div className="flex h-full min-h-[148px] min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {value}
            </p>
            {trend && (
              <span
                className={cn(
                  "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  trend.isPositive
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full flex-shrink-0",
              gasmaisIconTone[variant]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }

  const isColored = variant !== "default";

  return (
    <div
      className={cn(
        "modern-status-card flex h-full min-h-[148px] min-w-0 p-5 sm:p-6",
        variantStyles[variant]
      )}
    >
      <div className="flex w-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              isColored ? "opacity-90" : "text-muted-foreground"
            )}
          >
            {title}
          </p>
          <p className="mt-2 break-words text-2xl font-bold leading-tight sm:text-3xl">{value}</p>
          {trend && (
            <p
              className={cn(
                "mt-2 text-sm font-medium line-clamp-2",
                trend.isPositive
                  ? isColored
                    ? "opacity-90"
                    : "text-success"
                  : isColored
                  ? "opacity-90"
                  : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : "-"}
              {Math.abs(trend.value)}% em relação a ontem
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex-shrink-0 rounded-lg p-3",
            iconVariantStyles[variant]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

