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

export type SubdomainApp = "cliente" | "entregador" | "parceiro" | "erp" | "painel" | "landing" | null;

const SUBDOMAIN_MAP: Record<string, SubdomainApp> = {
  clientes: "cliente",
  cliente: "cliente",
  entregador: "entregador",
  entregadores: "entregador",
  app: "erp",
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
 * Returns the matched configured base domain for a given hostname.
 */
export function getMatchedBaseDomain(hostname: string = window.location.hostname.toLowerCase()): string | null {
  const normalized = hostname.toLowerCase();

  for (const baseDomain of BASE_DOMAINS) {
    if (
      normalized === baseDomain ||
      normalized === `www.${baseDomain}` ||
      normalized.endsWith(`.${baseDomain}`)
    ) {
      return baseDomain;
    }
  }

  return null;
}

/**
 * Returns the canonical hostname for each app context using the current base domain.
 */
export function getCanonicalHostnameForApp(
  app: Exclude<SubdomainApp, null>,
  currentHostname: string = window.location.hostname.toLowerCase()
): string {
  const baseDomain = getMatchedBaseDomain(currentHostname) ?? BASE_DOMAINS[0];

  switch (app) {
    case "erp":
      return `app.${baseDomain}`;
    case "painel":
      return `painel.${baseDomain}`;
    case "cliente":
      return `clientes.${baseDomain}`;
    case "entregador":
      return `entregador.${baseDomain}`;
    case "parceiro":
      return `portal.${baseDomain}`;
    case "landing":
      return baseDomain;
    default:
      return `app.${baseDomain}`;
  }
}

/**
 * Infers which app a route belongs to based on pathname.
 */
export function inferAppFromPath(pathname: string): Exclude<SubdomainApp, null> | null {
  if (!pathname) return null;

  if (pathname.startsWith("/admin")) return "painel";
  if (pathname.startsWith("/clientes")) return "erp";
  if (pathname.startsWith("/cliente")) return "cliente";
  if (pathname.startsWith("/entregador")) return "entregador";
  if (pathname.startsWith("/parceiro")) return "parceiro";

  const erpPrefixes = [
    "/dashboard",
    "/vendas",
    "/caixa",
    "/estoque",
    "/cadastros",
    "/clientes",
    "/financeiro",
    "/fiscal",
    "/frota",
    "/rh",
    "/config",
    "/operacional",
    "/atendimento",
    "/onboarding",
    "/entregas",
    "/assistente",
  ];

  if (erpPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "erp";
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
    case "parceiro": return "/parceiro";
    case "erp": return "/dashboard";
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
    case "erp":
      // app.gasfacilpro.com.br — full ERP access (same as old "painel" but for staff, not super_admin)
      return pathname === "/auth" || pathname.startsWith("/dashboard") || pathname.startsWith("/vendas")
        || pathname.startsWith("/caixa") || pathname.startsWith("/estoque") || pathname.startsWith("/cadastros")
        || pathname.startsWith("/clientes") || pathname.startsWith("/financeiro") || pathname.startsWith("/fiscal")
        || pathname.startsWith("/frota") || pathname.startsWith("/rh") || pathname.startsWith("/config")
        || pathname.startsWith("/operacional") || pathname.startsWith("/atendimento") || pathname.startsWith("/onboarding")
        || pathname.startsWith("/entregas") || pathname.startsWith("/assistente");
    case "painel":
      // painel.gasfacilpro.com.br — SaaS super admin only
      return pathname === "/auth" || pathname.startsWith("/admin");
    case "landing":
      return true;
    default:
      return true;
  }
}
