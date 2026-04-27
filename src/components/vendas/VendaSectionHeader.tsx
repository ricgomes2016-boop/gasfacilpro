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
  tone?: "primary" | "success" | "warning" | "info" | "critical" | "muted";
}

export const VENDA_SECTION_HEADER_THEME = {
  header: "section-header-info",
  title: "section-header-title",
  iconFrame: "section-header-icon-frame",
  icon: "shrink-0",
};

const toneClasses = {
  primary: "section-header-primary",
  success: "section-header-finance",
  warning: "section-header-stock",
  info: "section-header-catalog",
  critical: "section-header-critical",
  muted: "section-header-muted",
};

export function VendaSectionHeader({
  title,
  icon,
  action,
  className,
  withBorder = true,
  framedIcon = true,
  tone = "info",
}: VendaSectionHeaderProps) {
  return (
    <CardHeader
      className={cn(
        toneClasses[tone],
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