import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeroColor = "primary" | "success" | "danger" | "warning" | "info" | "violet";

interface HeroDetail {
  label: string;
  value: ReactNode;
}

interface FinancialHeroCardProps {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  color?: HeroColor;
  icon?: LucideIcon;
  progress?: number; // 0-100
  details?: HeroDetail[];
  className?: string;
  onClick?: () => void;
}

const gradients: Record<HeroColor, string> = {
  primary: "linear-gradient(135deg, hsl(var(--hero-blue)) 0%, hsl(var(--hero-blue-dark)) 100%)",
  success: "linear-gradient(135deg, hsl(var(--hero-green)) 0%, hsl(var(--hero-green-dark)) 100%)",
  danger: "linear-gradient(135deg, hsl(var(--hero-red)) 0%, hsl(var(--hero-red-dark)) 100%)",
  warning: "linear-gradient(135deg, hsl(var(--hero-amber)) 0%, hsl(var(--hero-amber-dark)) 100%)",
  info: "linear-gradient(135deg, hsl(var(--hero-blue)) 0%, hsl(var(--hero-violet-dark)) 100%)",
  violet: "linear-gradient(135deg, hsl(var(--hero-violet)) 0%, hsl(var(--hero-violet-dark)) 100%)",
};

/**
 * Card financeiro/operacional principal. Cor sólida, ícone em bloco translúcido,
 * valor em destaque, detalhes de resumo e círculo de progresso opcional.
 * Usa apenas tokens semânticos (hero-*) definidos em index.css.
 */
export function FinancialHeroCard({
  title,
  value,
  subtitle,
  color = "primary",
  icon: Icon,
  progress,
  details,
  className,
  onClick,
}: FinancialHeroCardProps) {
  const clickable = typeof onClick === "function";
  const radius = 82;
  const circ = 2 * Math.PI * radius;
  const dash = progress != null ? (Math.max(0, Math.min(100, progress)) / 100) * circ : 0;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{ background: gradients[color], borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)" }}
      className={cn(
        "relative overflow-hidden text-white",
        "p-5 sm:p-6",
        "transition-transform duration-200",
        clickable && "cursor-pointer hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        className
      )}
    >
      {/* decorative bubbles */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-14 -left-6 h-32 w-32 rounded-full bg-white/5" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <span className="text-sm font-medium text-white/85 truncate">{title}</span>
          </div>

          <div className="mt-4">
            <div className="text-3xl sm:text-[32px] font-bold tracking-tight leading-none">
              {value}
            </div>
            {subtitle && <p className="mt-2 text-xs sm:text-sm text-white/80">{subtitle}</p>}
          </div>

          {details && details.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {details.map((d) => (
                <div key={d.label} className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-white/70 truncate">{d.label}</p>
                  <p className="text-sm font-semibold text-white truncate">{d.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {progress != null && (
          <div className="relative shrink-0">
            <svg width="88" height="88" viewBox="0 0 200 200" className="-rotate-90">
              <circle cx="100" cy="100" r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth="16" fill="none" />
              <circle
                cx="100"
                cy="100"
                r={radius}
                stroke="white"
                strokeWidth="16"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${circ}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{Math.round(progress)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
