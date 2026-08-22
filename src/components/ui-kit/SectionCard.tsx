import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Ícone opcional exibido antes do título. */
  icon?: LucideIcon;
  /** Remove o padding do corpo (útil para tabelas). */
  flush?: boolean;
  /** Alias de compatibilidade para `flush`. */
  noPadding?: boolean;
  className?: string;
  bodyClassName?: string;
  /** Alias de compatibilidade para `bodyClassName`. */
  contentClassName?: string;
}

/**
 * Bloco de conteúdo canônico. Único nível de elevação — nunca aninhe
 * SectionCard dentro de SectionCard.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  icon: Icon,
  flush,
  noPadding,
  className,
  bodyClassName,
  contentClassName,
}: SectionCardProps) {
  const isFlush = flush ?? noPadding ?? false;
  return (
    <section
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-card border border-border/70 bg-card shadow-[var(--elev-1)]",
        className,
      )}
    >
      {(title || actions || description) && (
        <header className="flex min-w-0 flex-col gap-2 border-b border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            {title && (
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="truncate">{title}</span>
              </h3>
            )}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? "" : "p-3 sm:p-4", "min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}
