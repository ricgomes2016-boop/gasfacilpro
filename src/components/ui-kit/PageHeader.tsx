import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Conteúdo à direita (botões primários/secundários). */
  actions?: ReactNode;
  /** Elemento auxiliar exibido abaixo do título (badges, período, etc). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho canônico de página do ERP.
 * Substitui os <h1>/<h2> montados manualmente em cada tela.
 */
export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 flex-1">
        {title && <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>}
        {description && (
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>
        )}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}
