import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "app-card min-w-0 overflow-hidden rounded-lg text-card-foreground transition-[border-color,box-shadow,transform] duration-200",
  {
    variants: {
      variant: {
        default: "border border-border bg-card shadow-sm",
        flat: "border border-border bg-card shadow-none",
        sunken: "border border-transparent bg-muted/50",
        interactive:
          "border border-border bg-card shadow-sm cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        kpi: "kpi group relative border border-border bg-card shadow-sm",
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
    data-slot="card"
    data-card=""
    data-tone={variant === "kpi" && tone && tone !== "auto" ? tone : undefined}
    className={cn(cardVariants({ variant }), className)}
    {...props}
  />
));
Card.displayName = "Card";


const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="card-header" className={cn("app-card-header flex flex-col gap-1 px-4 py-3.5 text-card-foreground sm:px-5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} data-slot="card-title" className={cn("app-card-title min-w-0 break-words text-base font-semibold leading-snug tracking-normal text-foreground sm:text-[1.0625rem]", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="card-description" className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} data-slot="card-content" className={cn("app-card-content p-4 sm:p-5", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="card-footer" className={cn("app-card-footer flex flex-wrap items-center gap-2 px-4 pb-4 pt-0 sm:px-5 sm:pb-5", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
