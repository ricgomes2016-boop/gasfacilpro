import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface Props {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "dark";
}

/**
 * Hero premium para topos de dashboard — gradiente + textura sutil (grid SVG)
 * + halo, elevação forte. Padrão único usado por Admin e dashboards operacionais.
 */
export function DashboardHero({
  eyebrow, icon: Icon, title, description, actions, children, className, variant = "primary",
}: Props) {
  const bg = variant === "dark"
    ? "bg-[linear-gradient(135deg,hsl(222_35%_14%),hsl(222_40%_10%))]"
    : "";

  const style = variant === "primary" ? { background: "var(--gradient-hero)" } : undefined;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius)] p-6 text-primary-foreground shadow-[var(--elev-3)] sm:p-8",
        bg,
        className,
      )}
      style={style}
    >
      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><path d='M60 0H0v60' fill='none' stroke='white' stroke-width='1'/></svg>\")",
        }}
      />
      {/* Halo blobs */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 opacity-90" />}
              <Badge className="border-white/25 bg-white/15 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground hover:bg-white/20">
                {eyebrow}
              </Badge>
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-primary-foreground/80 sm:text-[0.95rem]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children && <div className="relative z-10 mt-5">{children}</div>}
    </div>
  );
}
