/**
 * Subdomain-based routing for GasFácil Pro SaaS
 * 
 * Subdomínios:
 * - clientes.gasfacilpro.com.br  → App do Cliente (/cliente)
 * - entregador.gasfacilpro.com.br → App do Entregador (/entregador)
 * - portal.gasfacilpro.com.br    → Portal do Parceiro (/parceiro)
 * - app.gasfacilpro.com.br       → Sistema ERP principal (/dashboard)
 * - painel.gasfacilpro.com.br    → Painel Admin SaaS (/admin)
 * - api.gasfacilpro.com.br       → API (handled by backend)
 * 
 * Em ambiente de desenvolvimento (localhost, preview), usa rotas normais.
 */

export type SubdomainApp = "cliente" | "entregador" | "parceiro" | "erp" | "painel" | "landing" | null;

const SUBDOMAIN_MAP: Record<string, SubdomainApp> = {
  clientes: "cliente",
  cliente: "cliente",
  entregador: "entregador",
  entregadores: "entregador",
  entregado: "entregador",
  portal: "parceiro",
  parceiro: "parceiro",
  app: "erp",
  painel: "painel",
  admin: "painel",
};

// Known base domains for the SaaS
const BASE_DOMAINS = [
  "gasfacilpro.com.br",
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
    // Root domain and www => landing
    if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
      return "landing";
    }

    if (hostname.endsWith(`.${baseDomain}`)) {
      // Everything before ".baseDomain"
      const prefix = hostname.slice(0, -(baseDomain.length + 1));

      if (!prefix || prefix === "www") {
        return "landing";
      }

      // IMPORTANT: use first label, not last.
      // Ex: entregador.painel.gasfacilpro.com.br -> "entregador"
      const firstLabel = prefix.split(".")[0];
      return SUBDOMAIN_MAP[firstLabel] || null;
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
    case "entregador": return "/entregador/dashboard";
    case "parceiro": return "/parceiro/dashboard";
    case "erp": return "/dashboard";
    case "painel": return "/admin";
    case "landing": return "/";
    default: return "/dashboard";
  }
}

/**
 * Checks if a given route path is allowed for the detected subdomain app.
 * This prevents users on clientes.gasfacilpro.com.br from accessing /admin routes, etc.
 */
export function isRouteAllowedForSubdomain(app: SubdomainApp, pathname: string): boolean {
  if (!app) return true; // No subdomain restriction in dev

  switch (app) {
    case "cliente":
      return pathname.startsWith("/cliente") || pathname === "/auth" || pathname.startsWith("/vale-gas");
    case "entregador":
      return pathname.startsWith("/entregador") || pathname === "/auth";
    case "parceiro":
      return pathname.startsWith("/parceiro") || pathname === "/auth";
    case "erp":
      return !pathname.startsWith("/admin") || pathname === "/auth";
    case "painel":
      return pathname.startsWith("/admin") || pathname === "/auth";
    case "landing":
      return true;
    default:
      return true;
  }
}
