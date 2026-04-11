import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ResponsiveDialog({ children, ...props }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const Component = isMobile ? Drawer : Dialog;
  return <Component {...props}>{children}</Component>;
}

export function ResponsiveDialogTrigger({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogTrigger>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerTrigger : DialogTrigger;
  return <Component {...props}>{children}</Component>;
}

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveDialogContent = React.forwardRef<HTMLDivElement, ResponsiveDialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const isMobile = useIsMobile();

    if (isMobile) {
      return (
        <DrawerContent ref={ref} className={cn("max-h-[85vh]", className)} {...props}>
          <div className="overflow-y-auto flex-1 px-4 pb-4">
            {children}
          </div>
        </DrawerContent>
      );
    }

    return (
      <DialogContent ref={ref as any} className={className} {...(props as any)}>
        {children}
      </DialogContent>
    );
  }
);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

export function ResponsiveDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerHeader : DialogHeader;
  return <Component className={className} {...props} />;
}

export function ResponsiveDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DrawerFooter
        className={cn("sticky bottom-0 bg-background border-t pt-4", className)}
        {...props}
      />
    );
  }
  return <DialogFooter className={className} {...props} />;
}

export function ResponsiveDialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogTitle>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerTitle : DialogTitle;
  return <Component className={className} {...(props as any)} />;
}

export function ResponsiveDialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogDescription>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerDescription : DialogDescription;
  return <Component className={className} {...(props as any)} />;
}

export function ResponsiveDialogClose({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogClose>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerClose : DialogClose;
  return <Component {...(props as any)}>{children}</Component>;
}
