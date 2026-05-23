import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { getRandomQuote, AuthPortalKey } from "@/lib/motivationalQuotes";

interface CircleAuthLayoutProps {
  portalKey: AuthPortalKey;
  title: string;
  subtitle?: string;
  /** HSL pair "H S% L%" used for the circle gradient */
  gradientFrom: string;
  gradientTo: string;
  /** Optional logo / icon shown above the title */
  logo?: ReactNode;
  /** Page background classes (gradient) */
  pageClassName?: string;
  /** Card surface classes — defaults to white card */
  cardClassName?: string;
  children: ReactNode;
}

/**
 * Split layout inspired by the "Circle" reference:
 * - Left: form (children)
 * - Right (md+): large gradient circle with a motivational quote
 * - Mobile: circle becomes a compact top header
 */
export function CircleAuthLayout({
  portalKey,
  title,
  subtitle,
  gradientFrom,
  gradientTo,
  logo,
  pageClassName,
  cardClassName,
  children,
}: CircleAuthLayoutProps) {
  // Fix the quote per mount so it doesn't change on re-renders within the same view.
  const [quote] = useState(() => getRandomQuote(portalKey));

  const gradientStyle = {
    background: `radial-gradient(circle at 30% 30%, hsl(${gradientFrom} / 0.95), hsl(${gradientTo}) 70%)`,
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center p-3 md:p-6 pb-20 md:pb-24",
        pageClassName ?? "bg-gradient-to-br from-background via-muted/20 to-background",
      )}
    >
      <div
        className={cn(
          "relative w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl border animate-fade-in",
          cardClassName ?? "bg-card border-border/40",
        )}
      >
        <div className="grid md:grid-cols-2">
          {/* MOBILE: top decorative arc with quote */}
          <div
            className="md:hidden relative h-44 flex items-end justify-center px-6 pb-5 text-white overflow-hidden"
            style={gradientStyle}
          >
            <div
              className="absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-30"
              style={{ background: `hsl(${gradientFrom})` }}
            />
            <p className="relative text-center text-sm font-medium leading-snug max-w-[260px] drop-shadow-sm">
              "{quote}"
            </p>
          </div>

          {/* FORM SIDE */}
          <div className="p-6 md:p-10 flex flex-col justify-center">
            <div className="mb-6 text-center md:text-left space-y-3">
              {logo && <div className="flex justify-center md:justify-start">{logo}</div>}
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {children}
          </div>

          {/* DESKTOP: right circle panel */}
          <div className="hidden md:flex relative items-center justify-center overflow-hidden min-h-[520px]">
            {/* Big circle */}
            <div
              className="absolute -right-32 top-1/2 -translate-y-1/2 w-[680px] h-[680px] rounded-full"
              style={gradientStyle}
            />
            {/* Decorative inner rings */}
            <div
              className="absolute -right-10 top-10 w-24 h-24 rounded-full border opacity-30"
              style={{ borderColor: `hsl(${gradientFrom} / 0.6)` }}
            />
            <div
              className="absolute right-40 bottom-12 w-12 h-12 rounded-full border opacity-40"
              style={{ borderColor: `hsl(${gradientTo} / 0.7)` }}
            />

            {/* Quote on top of circle */}
            <div className="relative z-10 text-white max-w-xs px-8 text-center md:text-left animate-fade-in">
              <div className="text-5xl font-serif leading-none opacity-70 mb-2">"</div>
              <p className="text-lg font-medium leading-relaxed drop-shadow">
                {quote}
              </p>
              <div className="mt-4 h-px w-16 bg-white/60" />
              <p className="mt-3 text-xs uppercase tracking-widest opacity-80">
                GásFácil Pro
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed footer with motivational quote */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: `hsl(${gradientFrom})` }}
          />
          <p className="text-xs md:text-sm text-muted-foreground italic text-center">
            "{quote}"
          </p>
        </div>
      </footer>
    </div>
  );
}
