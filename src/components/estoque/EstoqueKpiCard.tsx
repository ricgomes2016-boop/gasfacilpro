import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EstoqueKpiTone = "primary" | "info" | "success" | "warning" | "destructive" | "secondary";

const toneClasses: Record<EstoqueKpiTone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  secondary: "bg-secondary/40 text-secondary-foreground",
};

interface EstoqueKpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: EstoqueKpiTone;
  hint?: string;
  className?: string;
}

export function EstoqueKpiCard({ icon: Icon, label, value, tone = "primary", hint, className }: EstoqueKpiCardProps) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10", toneClasses[tone])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-sm text-muted-foreground leading-tight line-clamp-1">{label}</p>
          <p className="text-[1.05rem] sm:text-2xl font-bold text-foreground leading-tight break-words">{value}</p>
          {hint && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
