import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}

/**
 * Padrão único para seções em Card.
 * NUNCA aninhar SectionCard dentro de SectionCard — use <div className="space-y-4"> por dentro.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
  noPadding = false,
}: SectionCardProps) {
  const hasHeader = title || actions;
  return (
    <Card className={cn("border-border bg-card", className)}>
      {hasHeader && (
        <CardHeader className="flex flex-col gap-2 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                <span className="truncate">{title}</span>
              </CardTitle>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding ? "p-0" : "p-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
