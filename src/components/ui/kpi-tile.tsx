import * as React from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "blue" | "orange" | "amber" | "green" | "red";

const TONES: Record<KpiTone, string> = {
  blue: "bg-[#4f68e8]",
  orange: "bg-[#e97832]",
  amber: "bg-[#e7a936]",
  green: "bg-[#66bd67]",
  red: "bg-[#c83c35]",
};

export interface KpiTileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ElementType;
  tone?: KpiTone;
  hint?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Solid-color KPI tile matching the Dashboard "Acesso Rápido" look. */
export function KpiTile({ label, value, icon: Icon, tone = "blue", hint, onClick, className }: KpiTileProps) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ color: "#fff" }}
      className={cn(
        "quick-action-tile flex min-h-[96px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-4 text-center !text-white shadow-[0_12px_22px_-16px_rgba(15,23,42,0.6)]",
        onClick && "transition-all duration-150 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-6 w-6 shrink-0 !text-white" strokeWidth={2.25} />}
      <span className="max-w-full break-words text-xl font-black leading-none !text-white sm:text-2xl">{value}</span>
      <span className="w-full break-words text-[12px] font-bold leading-tight !text-white">{label}</span>
      {hint && <span className="w-full break-words text-[11px] font-medium leading-tight !text-white opacity-90">{hint}</span>}
    </Comp>
  );
}

/** Grid: 2 per row on mobile; last tile spans full row when count is odd. */
export function KpiTileGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>
      {items.map((child, i) =>
        items.length % 2 === 1 && i === items.length - 1 && React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, {
              className: cn((child as any).props.className, "col-span-2 md:col-span-1"),
            })
          : child,
      )}
    </div>
  );
}
