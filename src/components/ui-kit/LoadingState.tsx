import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-muted", className)} />;
}

export interface LoadingStateProps {
  /** Linhas de esqueleto. */
  rows?: number;
  className?: string;
}

/** Estado de carregamento canônico para listas e tabelas. */
export function LoadingState({ rows = 5, className }: LoadingStateProps) {
  return (
    <div className={cn("w-full space-y-2 p-3 sm:p-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Esqueleto para uma linha de KPIs. */
export function KpiSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[92px] w-full rounded-card" />
      ))}
    </div>
  );
}
