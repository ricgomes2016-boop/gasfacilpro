import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius)] border px-2.5 py-1 text-xs font-bold leading-none shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
        secondary: "border-secondary/40 bg-secondary/15 text-foreground hover:bg-secondary/25",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline: "border-border/45 bg-card text-foreground",
        success: "border-success/20 bg-success/10 text-success hover:bg-success/15",
        warning: "border-warning/25 bg-warning/15 text-warning-foreground hover:bg-warning/20",
        info: "border-info/20 bg-info/10 text-info hover:bg-info/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});
Badge.displayName = "Badge";

export { Badge, badgeVariants };
