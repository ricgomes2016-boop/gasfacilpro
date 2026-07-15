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
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold text-foreground truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground truncate mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
