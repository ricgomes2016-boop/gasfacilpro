import { cn } from "@/lib/utils";

/** Base shimmer utility — mais rico que animate-pulse cru. */
function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r",
        "before:from-transparent before:via-white/40 before:to-transparent dark:before:via-white/10",
        className,
      )}
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="relative min-h-[132px] overflow-hidden rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2.5">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-7 w-32" />
          <Shimmer className="h-2.5 w-20" />
        </div>
        <Shimmer className="h-10 w-10 rounded-[calc(var(--radius)-4px)]" />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <Shimmer className="h-4 w-16 rounded-full" />
        <Shimmer className="h-8 w-20" />
      </div>
    </div>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <KpiCardSkeleton key={i} />)}
    </div>
  );
}

export function ChartCardSkeleton({ height = 260, title = true }: { height?: number; title?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-1)]">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-6 w-24 rounded-full" />
        </div>
      )}
      <div className="relative w-full" style={{ height }}>
        {/* faux gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-px bg-border/40" />
          ))}
        </div>
        {/* faux bars */}
        <div className="absolute inset-x-2 bottom-0 flex items-end justify-between gap-2">
          {[0.4, 0.65, 0.5, 0.8, 0.35, 0.9, 0.55, 0.7, 0.45, 0.75].map((h, i) => (
            <Shimmer key={i} className="w-full rounded-t-md" style={{ height: `${h * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
