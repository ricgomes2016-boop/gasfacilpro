import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getRandomQuote, AuthPortalKey } from "@/lib/motivationalQuotes";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { FOOTER_ACTIONS_ID, FOOTER_CENTER_ID } from "./footerPortals";

interface SystemFooterProps {
  portalKey?: AuthPortalKey;
  accentHsl?: string;
  className?: string;
}

const ACCENT_BY_PORTAL: Record<AuthPortalKey, string> = {
  erp: "24 95% 53%",
  painel: "265 84% 60%",
  cliente: "200 95% 50%",
  entregador: "142 70% 45%",
  vendedor: "160 75% 45%",
  contador: "215 85% 55%",
  transportadora: "30 90% 50%",
  parceiro: "340 80% 55%",
  api: "260 70% 60%",
};

function detectPortalKey(pathname: string): AuthPortalKey {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const sub = host.split(".")[0];
  if (sub === "painel" || sub === "admin") return "painel";
  if (sub === "clientes" || sub === "cliente") return "cliente";
  if (sub === "entregador") return "entregador";
  if (sub === "vendas" || sub === "vendedor" || sub === "vendedores") return "vendedor";
  if (sub === "contador") return "contador";
  if (sub === "transporte" || sub === "transportadora") return "transportadora";
  if (sub === "parceiro") return "parceiro";

  if (pathname.startsWith("/admin")) return "painel";
  if (pathname.startsWith("/cliente")) return "cliente";
  if (pathname.startsWith("/entregador")) return "entregador";
  if (pathname.startsWith("/vendedor")) return "vendedor";
  if (pathname.startsWith("/contador")) return "contador";
  if (pathname.startsWith("/transportadora")) return "transportadora";
  if (pathname.startsWith("/parceiro")) return "parceiro";
  return "erp";
}

/**
 * Fixed system footer.
 * - Left: accent dot
 * - Center: portal slot (e.g. Nova Venda stepper); falls back to motivational quote
 * - Right: portal slot for floating action buttons (AI / WhatsApp)
 */
export function SystemFooter({ portalKey, accentHsl, className }: SystemFooterProps) {
  const location = useLocation();
  const { collapsed } = useSidebarContext();
  const resolvedKey = useMemo(
    () => portalKey ?? detectPortalKey(location.pathname),
    [portalKey, location.pathname],
  );
  const [quote] = useState(() => getRandomQuote(resolvedKey));
  const [centerOverride, setCenterOverride] = useState(false);
  const dotColor = accentHsl ?? ACCENT_BY_PORTAL[resolvedKey] ?? ACCENT_BY_PORTAL.erp;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setCenterOverride(Boolean(detail));
    };
    window.addEventListener("system-footer:center", handler);
    return () => window.removeEventListener("system-footer:center", handler);
  }, []);

  return (
    <footer
      className={cn(
        "fixed bottom-0 right-0 left-0 z-40 border-t border-border/40 bg-background/85 backdrop-blur-md transition-all duration-300",
        // Desktop: always show; Mobile: only when center slot is active (e.g. Nova Venda stepper)
        centerOverride ? "flex" : "hidden md:flex",
        collapsed ? "xl:left-16" : "xl:left-[260px]",
        className,
      )}
      style={centerOverride ? { paddingBottom: "env(safe-area-inset-bottom)" } : undefined}
    >
      <div className={cn("w-full mx-auto flex items-center", centerOverride ? "px-2 py-1 gap-2 md:px-3 md:py-1.5 md:gap-3" : "px-3 py-1.5 gap-3")}>
        {/* Left: accent — hidden on mobile to free width for stepper */}
        <div
          className="w-2 h-2 rounded-full shrink-0 hidden md:block"
          style={{ background: `hsl(${dotColor})` }}
          aria-hidden
        />

        {/* Center: portal target (stepper with back/next) */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <div id={FOOTER_CENTER_ID} className="w-full" />
        </div>


        {/* Right: action buttons (AI, WhatsApp, etc.) — desktop only */}
        <div
          id={FOOTER_ACTIONS_ID}
          className="hidden md:flex items-center gap-1.5 shrink-0"
        />
      </div>

    </footer>
  );
}

