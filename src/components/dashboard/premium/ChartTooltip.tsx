import { TooltipProps } from "recharts";
import { cn } from "@/lib/utils";

interface Props extends TooltipProps<any, any> {
  formatter?: (value: number, name: string) => string;
  className?: string;
}

/**
 * Tooltip customizado alinhado ao design system:
 * usa tokens de popover, mesma sombra dos cards, tipografia consistente.
 */
export function ChartTooltip({ active, payload, label, formatter, className }: Props) {
  if (!active || !payload || !payload.length) return null;

  const fmt = formatter ?? ((v: number) => Number(v).toLocaleString("pt-BR"));

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-[calc(var(--radius)-4px)] border border-border/60 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-[var(--elev-3)] backdrop-blur-md",
        className,
      )}
    >
      {label !== undefined && label !== "" && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.color }}
              />
              <span className="text-[11px] text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-semibold tabular-nums text-foreground">
              {fmt(entry.value, entry.name)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
