import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "./PageHeader";

export interface AppPageProps {
  /** Opcional: quando ausente, a página não renderiza cabeçalho próprio (o Header global já o exibe). */
  title?: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  /** Largura máxima do conteúdo. `full` para telas de mapa/kanban. */
  width?: "default" | "full";
  className?: string;
}

/**
 * Container canônico de conteúdo de página.
 * Aplica padding, largura e espaçamento verticais consistentes em todo o ERP.
 */
export function AppPage({
  title,
  description,
  actions,
  meta,
  children,
  width = "default",
  className,
}: AppPageProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full space-y-5 px-3 py-4 sm:px-5 sm:py-6",
        width === "default" && "mx-auto max-w-[1440px]",
        className,
      )}
    >
      {(title || description || actions || meta) && (
        <PageHeader title={title ?? ""} description={description} actions={actions} meta={meta} />
      )}
      <div className="w-full min-w-0 space-y-4">{children}</div>
    </div>
  );
}
