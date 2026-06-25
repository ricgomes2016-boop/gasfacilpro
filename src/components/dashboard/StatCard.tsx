import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { Card } from "@/components/ui/card";

const variantToTone: Record<string, "violet" | "green" | "amber" | "blue" | "sky" | "red"> = {
  default: "sky",
  primary: "violet",
  success: "green",
  warning: "amber",
  info: "blue",
};

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
  default: "border-border/45 bg-card text-card-foreground",
  primary: "border-border/45 border-l-4 border-l-primary bg-card text-card-foreground shadow-primary/10",
  success: "border-border/45 border-l-4 border-l-success bg-card text-card-foreground shadow-success/10",
  warning: "border-border/45 border-l-4 border-l-warning bg-card text-card-foreground shadow-warning/10",
  info: "border-border/45 border-l-4 border-l-info bg-card text-card-foreground shadow-info/10",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/10 text-info",
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
  const { isGasmaisDashboard } = useDashboardTheme();

  // Colored modern card (GásMais) — gradient + shadow + hover animation
  if (isGasmaisDashboard && colored) {
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
        "group relative flex h-full min-h-[148px] min-w-0 overflow-hidden rounded-2xl border border-border/45 bg-card p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
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
              "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-primary-foreground shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
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
  if (isGasmaisDashboard && onHero) {
    return (
      <div className="flex h-full min-h-[138px] min-w-0 flex-col justify-between rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 p-4 transition-all hover:bg-primary-foreground/15">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-3 min-w-0 flex-1">
            <p className="break-words text-2xl sm:text-3xl font-bold text-primary-foreground tracking-tight leading-tight">
            {value}
          </p>
        </div>
        <div className="mt-3 min-h-[40px] min-w-0">
            <p className="text-sm font-medium text-primary-foreground/90 line-clamp-1">{title}</p>
          {subtitle && (
              <p className="text-xs text-primary-foreground/60 mt-0.5 line-clamp-1">{subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  if (isGasmaisDashboard) {
    return (
      <div className={cn("flex h-full min-h-[148px] min-w-0 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md", variantStyles[variant])}>
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

  // Default: solid-colored KPI tile (matches Dashboard KPI styling)
  const tone = variantToTone[variant] ?? "sky";
  return (
    <Card variant="kpi" tone={tone} className="flex h-full min-h-[148px] min-w-0 p-5 sm:p-6">
      <div className="flex w-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide opacity-90">
            {title}
          </p>
          <p className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs opacity-85 line-clamp-2">{subtitle}</p>
          )}
          {trend && (
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-[var(--radius)] bg-white/15 px-2 py-0.5 text-xs font-semibold"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius)] bg-white/15">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}


