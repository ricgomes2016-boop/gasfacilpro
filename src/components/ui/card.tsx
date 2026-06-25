import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "app-card min-w-0 overflow-hidden rounded-xl text-card-foreground transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "border border-border/60 bg-card shadow-[0_1px_2px_hsl(220_25%_10%/0.04),0_2px_8px_-4px_hsl(220_25%_10%/0.06)]",
        flat: "border border-border/60 bg-card",
        sunken: "border border-transparent bg-muted/50",
        interactive:
          "border border-border/60 bg-card shadow-[0_1px_2px_hsl(220_25%_10%/0.04),0_2px_8px_-4px_hsl(220_25%_10%/0.06)] cursor-pointer hover:border-primary/35 hover:shadow-[0_2px_4px_hsl(220_25%_10%/0.06),0_8px_20px_-8px_hsl(220_25%_10%/0.12)]",
        kpi: "kpi border border-border/60 bg-gradient-to-br from-card to-muted/40 shadow-[0_1px_2px_hsl(220_25%_10%/0.04),0_4px_12px_-6px_hsl(220_25%_10%/0.08)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  tone?: "green" | "blue" | "violet" | "amber" | "red" | "sky" | "auto";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, tone, ...props }, ref) => (
  <div
    ref={ref}
    data-card=""
    data-tone={variant === "kpi" && tone && tone !== "auto" ? tone : undefined}
    className={cn(cardVariants({ variant }), className)}
    {...props}
  />
));
Card.displayName = "Card";


const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("app-card-header flex flex-col gap-1 px-5 py-4 text-card-foreground", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("app-card-title min-w-0 break-words text-base font-semibold leading-snug tracking-[-0.005em] text-foreground sm:text-[1.0625rem]", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("app-card-content p-5", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("app-card-footer flex flex-wrap items-center gap-2 px-5 pb-5 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
