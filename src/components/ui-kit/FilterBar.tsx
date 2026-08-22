import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Selects / date pickers / toggles adicionais. */
  children?: ReactNode;
  /** Ações à direita (exportar, novo, etc). */
  actions?: ReactNode;
  className?: string;
}

/** Barra de filtros canônica: busca + filtros + ações, responsiva por padrão. */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  children,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2 rounded-card border border-border/70 bg-card p-2.5 shadow-[var(--elev-1)] sm:flex-row sm:flex-wrap sm:items-center sm:p-3",
        className,
      )}
    >
      {onSearchChange && (
        <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full min-w-0 rounded-control pl-8 pr-8 text-base sm:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {children && <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>}
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}

export { Button as FilterBarButton };
