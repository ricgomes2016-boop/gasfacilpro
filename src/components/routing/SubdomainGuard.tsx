import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  detectSubdomainApp,
  getCanonicalHostnameForApp,
  getSubdomainDefaultRoute,
  inferAppFromPath,
  isRouteAllowedForSubdomain,
  SubdomainApp,
} from "@/lib/subdomain";

interface SubdomainGuardProps {
  children: ReactNode;
}

/**
 * Wraps the app routes and enforces subdomain-based access control.
 * - Redirects to canonical domain when route belongs to another app
 * - Redirects to the correct default route on first load if on root "/"
 * - Blocks navigation to routes not allowed for the current subdomain
 */
export function SubdomainGuard({ children }: SubdomainGuardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const subdomainApp = detectSubdomainApp();

  useEffect(() => {
    if (!subdomainApp) return; // Dev mode — no restrictions

    const hostname = window.location.hostname.toLowerCase();
    const { pathname, search, hash } = location;

    // www.gasfacilpro.com.br → redirect to app.gasfacilpro.com.br
    if (subdomainApp === "landing" && hostname.startsWith("www.")) {
      const appHost = getCanonicalHostnameForApp("erp", hostname);
      window.location.href = `${window.location.protocol}//${appHost}${pathname}${search}${hash}`;
      return;
    }

    // Cross-subdomain canonical redirect based on route family
    const routeApp = inferAppFromPath(pathname);
    if (routeApp && routeApp !== subdomainApp) {
      const targetHost = getCanonicalHostnameForApp(routeApp, hostname);
      window.location.href = `${window.location.protocol}//${targetHost}${pathname}${search}${hash}`;
      return;
    }

    // Root "/" → redirect to subdomain default
    if (pathname === "/" || pathname === "") {
      const defaultRoute = getSubdomainDefaultRoute(subdomainApp);
      navigate(defaultRoute, { replace: true });
      return;
    }

    // Block disallowed routes
    if (!isRouteAllowedForSubdomain(subdomainApp, pathname)) {
      const defaultRoute = getSubdomainDefaultRoute(subdomainApp);
      navigate(defaultRoute, { replace: true });
    }
  }, [location, subdomainApp, navigate]);

  return <>{children}</>;
}

/**
 * Hook to get the current subdomain app context
 */
export function useSubdomainApp(): SubdomainApp {
  return detectSubdomainApp();
}
