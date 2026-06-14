import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getRandomQuote, AuthPortalKey } from "@/lib/motivationalQuotes";
import { useSidebarContext } from "@/contexts/SidebarContext";

interface SystemFooterProps {
  /** Optional override for the portal key. If omitted, inferred from subdomain/path. */
  portalKey?: AuthPortalKey;
  /** Optional HSL color string ("H S% L%") for the accent dot. */
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
 * Fixed system footer with a motivational quote.
 * Hidden on mobile to avoid conflict with MobileBottomBar.
 */
export function SystemFooter({ portalKey, accentHsl, className }: SystemFooterProps) {
  const location = useLocation();
  const { collapsed } = useSidebarContext();
  const resolvedKey = useMemo(
    () => portalKey ?? detectPortalKey(location.pathname),
    [portalKey, location.pathname],
  );
  const [quote] = useState(() => getRandomQuote(resolvedKey));
  const dotColor = accentHsl ?? ACCENT_BY_PORTAL[resolvedKey] ?? ACCENT_BY_PORTAL.erp;

  return (
    <footer
      className={cn(
        "hidden md:flex fixed bottom-0 right-0 z-40 border-t border-border/40 bg-background/80 backdrop-blur-md transition-all duration-300",
        "left-0",
        collapsed ? "xl:left-16" : "xl:left-[260px]",
        className,
      )}
    >
      <div className="w-full max-w-5xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: `hsl(${dotColor})` }}
        />
        <p className="text-xs md:text-sm text-muted-foreground italic text-center truncate">
          "{quote}"
        </p>
      </div>
    </footer>
  );
}
