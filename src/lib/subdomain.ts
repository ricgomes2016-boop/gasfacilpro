/**
 * Subdomain-based routing for GasFácil Pro SaaS
 * 
 * Subdomínios:
 * - cliente.gasfacilpro.com.br    → App do Cliente (/cliente)
 * - entregador.gasfacilpro.com.br → App do Entregador (/entregador)
 * - app.gasfacilpro.com.br        → Painel Admin / ERP (/admin)
 * - parceiro.gasfacilpro.com.br   → Portal do Parceiro (/parceiro)
 * 
 * Em ambiente de desenvolvimento (localhost, preview), usa rotas normais.
 */

export type SubdomainApp = "cliente" | "entregador" | "parceiro" | "painel" | "landing" | null;

const SUBDOMAIN_MAP: Record<string, SubdomainApp> = {
  clientes: "cliente",
  cliente: "cliente",
  entregador: "entregador",
  entregadores: "entregador",
  app: "painel",
  painel: "painel",
  admin: "painel",
  portal: "parceiro",
  parceiro: "parceiro",
};

// Known base domains for the SaaS
const BASE_DOMAINS = [
  "gasfacilpro.com.br",
  "gasfacilpro.lovable.app",
  "gasfacil-entregas.lovable.app",
];

/**
 * Detects which app should be rendered based on the current hostname subdomain.
 * Returns null for development environments or unrecognized subdomains.
 */
export function detectSubdomainApp(): SubdomainApp {
  const hostname = window.location.hostname.toLowerCase();

  // Development: localhost or IP — no subdomain routing
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168")) {
    return null;
  }

  // Preview environments (lovable preview URLs) — no subdomain routing
  if (hostname.includes("-preview--")) {
    return null;
  }

  // Check against known base domains
  for (const baseDomain of BASE_DOMAINS) {
    if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
      return "landing";
    }

    if (hostname.endsWith(`.${baseDomain}`)) {
      const prefix = hostname.slice(0, -(baseDomain.length + 1));

      if (!prefix || prefix === "www") {
        return "landing";
      }

      const labels = prefix.split(".").filter(Boolean);
      const matched = labels.find((label) => label !== "www" && SUBDOMAIN_MAP[label]);
      return matched ? SUBDOMAIN_MAP[matched] : null;
    }
  }

  return null;
}

/**
 * Returns the default route path for a given subdomain app.
 */
export function getSubdomainDefaultRoute(app: SubdomainApp): string {
  switch (app) {
    case "cliente": return "/cliente";
    case "entregador": return "/entregador";
    case "parceiro": return "/parceiro/dashboard";
    case "painel": return "/admin";
    case "landing": return "/";
    default: return "/dashboard";
  }
}

/**
 * Checks if a given route path is allowed for the detected subdomain app.
 */
export function isRouteAllowedForSubdomain(app: SubdomainApp, pathname: string): boolean {
  if (!app) return true;

  switch (app) {
    case "cliente":
      return pathname.startsWith("/cliente") || pathname === "/auth" || pathname.startsWith("/vale-gas");
    case "entregador":
      return pathname.startsWith("/entregador") || pathname === "/auth";
    case "parceiro":
      return pathname.startsWith("/parceiro") || pathname === "/auth";
    case "painel":
      // app.gasfacilpro.com.br — full admin + ERP access
      return pathname === "/auth" || pathname.startsWith("/admin") || pathname.startsWith("/dashboard")
        || pathname.startsWith("/vendas") || pathname.startsWith("/caixa") || pathname.startsWith("/estoque")
        || pathname.startsWith("/cadastros") || pathname.startsWith("/clientes") || pathname.startsWith("/financeiro")
        || pathname.startsWith("/fiscal") || pathname.startsWith("/frota") || pathname.startsWith("/rh")
        || pathname.startsWith("/config") || pathname.startsWith("/operacional") || pathname.startsWith("/atendimento")
        || pathname.startsWith("/onboarding") || pathname.startsWith("/entregas") || pathname.startsWith("/assistente");
    case "landing":
      return true;
    default:
      return true;
  }
}
