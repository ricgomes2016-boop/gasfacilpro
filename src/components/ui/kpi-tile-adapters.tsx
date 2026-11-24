import * as React from "react";
import { KpiTile, type KpiTone } from "@/components/ui/kpi-tile";

/** Maps legacy semantic tones to the solid Acesso Rápido palette. */
export function solidTone(tone?: string): KpiTone {
  switch (tone) {
    case "success": return "green";
    case "warning": return "amber";
    case "destructive": return "red";
    case "accent": return "orange";
    default: return "blue";
  }
}

type Legacy = {
  label?: string; title?: string; value: React.ReactNode; icon?: React.ElementType; tone?: string;
  hint?: React.ReactNode; subtitle?: React.ReactNode; description?: React.ReactNode;
  onClick?: () => void; className?: string; [k: string]: unknown;
};

/** Drop-in replacement for older KPI cards; renders the shared solid KpiTile. */
export function SolidKpiCard({ label, title, value, icon, tone, hint, subtitle, description, onClick, className }: Legacy) {
  return (
    <KpiTile label={label ?? title} value={value} icon={icon} tone={solidTone(tone)}
      hint={hint ?? subtitle ?? description} onClick={onClick} className={className} />
  );
}
