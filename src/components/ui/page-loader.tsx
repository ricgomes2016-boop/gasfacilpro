import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoaderProps {
  label?: string;
  className?: string;
}

export function PageLoader({ label = "Carregando...", className }: LoaderProps) {
  return (
    <div className={cn("flex items-center justify-center min-h-[60vh]", className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function PageSectionLoader({ label = "Carregando dados...", className }: LoaderProps) {
  return (
    <div className={cn("flex min-h-64 items-center justify-center rounded-lg border border-dashed bg-card/50", className)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
