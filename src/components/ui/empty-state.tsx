import { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
};

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-center",
        compact ? "px-4 py-5" : "px-6 py-10",
        className,
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border/60",
          compact ? "h-9 w-9" : "h-12 w-12",
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>

      <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
      {description ? (
        <p className={cn("mt-1 max-w-md text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {description}
        </p>
      ) : null}

      {action?.href ? (
        <Button asChild size={compact ? "sm" : "default"} className="mt-4 gap-2">
          <a href={action.href}>
            {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
            {action.label}
          </a>
        </Button>
      ) : action?.onClick ? (
        <Button size={compact ? "sm" : "default"} className="mt-4 gap-2" onClick={action.onClick}>
          {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
          {action.label}
        </Button>
      ) : null}

      {children}
    </div>
  );
}
