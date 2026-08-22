import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Remove o padding do corpo (útil para tabelas). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
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
  flush,
  className,
  bodyClassName,
}: SectionCardProps) {
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
            {title && <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? "" : "p-3 sm:p-4", "min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}
