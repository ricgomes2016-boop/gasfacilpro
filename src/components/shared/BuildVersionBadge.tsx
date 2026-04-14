import { Badge } from "@/components/ui/badge";
import { APP_BUILD_LABEL } from "@/lib/app-build";
import { cn } from "@/lib/utils";

interface BuildVersionBadgeProps {
  className?: string;
  prefix?: string;
  tone?: "default" | "on-primary";
}

export function BuildVersionBadge({
  className,
  prefix = "Build",
  tone = "default",
}: BuildVersionBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-full px-2 text-[10px] font-medium border-border/70 bg-muted/40 text-muted-foreground",
        tone === "on-primary" && "border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground",
        className,
      )}
    >
      {prefix} {APP_BUILD_LABEL}
    </Badge>
  );
}