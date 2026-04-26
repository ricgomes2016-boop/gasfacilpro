import type { ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface VendaSectionHeaderProps {
  title: ReactNode;
  icon: ReactNode;
  action?: ReactNode;
  className?: string;
  withBorder?: boolean;
  framedIcon?: boolean;
}

export function VendaSectionHeader({
  title,
  icon,
  action,
  className,
  withBorder = true,
  framedIcon = true,
}: VendaSectionHeaderProps) {
  return (
    <CardHeader
      className={cn(
        "bg-primary p-4 pb-3 text-primary-foreground",
        withBorder && "border-b",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base text-primary-foreground">
          {framedIcon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15 text-primary-foreground">
              {icon}
            </span>
          ) : (
            <span className="shrink-0 text-primary-foreground">{icon}</span>
          )}
          <span className="truncate">{title}</span>
        </CardTitle>
        {action}
      </div>
    </CardHeader>
  );
}