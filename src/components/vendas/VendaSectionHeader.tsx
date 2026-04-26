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
  header: "section-header-primary",
  title: "section-header-title",
  iconFrame: "section-header-icon-frame",
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