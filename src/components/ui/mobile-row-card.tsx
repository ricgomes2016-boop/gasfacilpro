import * as React from "react";
import { cn } from "@/lib/utils";
import type { KpiTone } from "@/components/ui/kpi-tile";

const STRIPE: Record<KpiTone | "gray", string> = {
  blue: "bg-[#4f68e8]",
  orange: "bg-[#e97832]",
  amber: "bg-[#e7a936]",
  green: "bg-[#66bd67]",
  red: "bg-[#c83c35]",
  gray: "bg-muted-foreground/40",
};

export interface MobileRowMetric {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}

export interface MobileRowCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Badge/status element shown at top-right. */
  status?: React.ReactNode;
  tone?: KpiTone | "gray";
  metrics?: MobileRowMetric[];
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Mobile replacement for a table row: colored status stripe, title, up to 3 metrics, actions. */
export function MobileRowCard({ title, subtitle, status, tone = "gray", metrics = [], actions, onClick, className }: MobileRowCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card py-3 pl-4 pr-3 shadow-sm",
        onClick && "cursor-pointer active:bg-muted/40",
        className,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", STRIPE[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-bold leading-tight text-foreground">{title}</p>
          {subtitle && <div className="mt-0.5 break-words text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {status && <div className="shrink-0">{status}</div>}
      </div>
      {metrics.length > 0 && (
        <div
          className="mt-3 grid divide-x divide-border rounded-lg bg-muted/40 py-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 3)}, minmax(0, 1fr))` }}
        >
          {metrics.slice(0, 3).map((m, i) => (
            <div key={i} className="min-w-0 px-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className={cn("truncate text-sm font-bold tabular-nums text-foreground", m.className)}>{m.value}</p>
            </div>
          ))}
        </div>
      )}
      {actions && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function MobileCardList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2 md:hidden", className)}>{children}</div>;
}
