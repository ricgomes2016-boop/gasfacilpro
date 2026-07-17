import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold leading-[1.25] ring-offset-background shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/25",
        destructive: "bg-destructive text-destructive-foreground shadow-destructive/20 hover:bg-destructive/90 hover:shadow-destructive/25",
        outline: "border border-input/80 bg-card text-foreground hover:border-primary/45 hover:bg-primary/10 hover:text-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-foreground/10",
        ghost: "shadow-none hover:bg-primary/10 hover:text-primary hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
        action: "border border-primary/25 bg-primary/10 text-primary shadow-primary/10 hover:border-primary/45 hover:bg-primary hover:text-primary-foreground hover:shadow-primary/25",
        media: "border border-info/25 bg-info/10 text-info shadow-info/10 hover:border-info/45 hover:bg-info hover:text-info-foreground hover:shadow-info/25",
        photo: "border border-info/25 bg-info/10 text-info shadow-info/10 hover:border-info/45 hover:bg-info hover:text-info-foreground hover:shadow-info/25",
        import: "border border-primary/25 bg-primary/10 text-primary shadow-primary/10 hover:border-primary/45 hover:bg-primary hover:text-primary-foreground hover:shadow-primary/25",
        pdf: "border border-destructive/25 bg-destructive/10 text-destructive shadow-destructive/10 hover:border-destructive/45 hover:bg-destructive hover:text-destructive-foreground hover:shadow-destructive/25",
        microphone: "border border-accent/25 bg-accent/10 text-accent shadow-accent/10 hover:border-accent/45 hover:bg-accent hover:text-accent-foreground hover:shadow-accent/25",
        success: "border border-success/25 bg-success/10 text-success shadow-success/10 hover:border-success/45 hover:bg-success hover:text-success-foreground hover:shadow-success/25",
        warning: "border border-warning/25 bg-warning/10 text-warning-foreground shadow-warning/10 hover:border-warning/45 hover:bg-warning hover:text-warning-foreground hover:shadow-warning/25",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 rounded-2xl px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
