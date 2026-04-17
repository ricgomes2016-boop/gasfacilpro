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
  default: "bg-card",
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
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
}: StatCardProps) {
  const { isGasmais } = useDashboardTheme();

  // Hero tile (translucent on orange gradient) — GásMais inside hero
  if (isGasmais && onHero) {
    return (
      <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 transition-all hover:bg-white/15">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 mb-3">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none">
          {value}
        </p>
        <p className="mt-2 text-sm font-medium text-white/90">{title}</p>
        {subtitle && (
          <p className="text-xs text-white/60 mt-0.5">{subtitle}</p>
        )}
      </div>
    );
  }

  if (isGasmais) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
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
        "rounded-xl p-6 shadow-md transition-all duration-200 hover:shadow-lg",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              isColored ? "opacity-90" : "text-muted-foreground"
            )}
          >
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {trend && (
            <p
              className={cn(
                "mt-2 text-sm font-medium",
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
            "rounded-lg p-3",
            iconVariantStyles[variant]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

