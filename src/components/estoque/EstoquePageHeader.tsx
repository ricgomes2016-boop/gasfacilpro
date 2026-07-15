import { ReactNode } from "react";

interface EstoquePageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function EstoquePageHeader({ title, description, actions }: EstoquePageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
