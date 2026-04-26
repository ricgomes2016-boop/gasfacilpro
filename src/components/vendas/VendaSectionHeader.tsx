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

export const VENDA_SECTION_HEADER_THEME = {
  header: "bg-primary p-4 pb-3 text-primary-foreground",
  title: "flex min-w-0 items-center gap-2 text-base text-primary-foreground",
  iconFrame: "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15 text-primary-foreground",
  icon: "shrink-0 text-primary-foreground",
};

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
        VENDA_SECTION_HEADER_THEME.header,
        withBorder && "border-b",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className={VENDA_SECTION_HEADER_THEME.title}>
          {framedIcon ? (
            <span className={VENDA_SECTION_HEADER_THEME.iconFrame}>
              {icon}
            </span>
          ) : (
            <span className={VENDA_SECTION_HEADER_THEME.icon}>{icon}</span>
          )}
          <span className="truncate">{title}</span>
        </CardTitle>
        {action}
      </div>
    </CardHeader>
  );
}