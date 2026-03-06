import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { detectSubdomainApp, getSubdomainDefaultRoute, isRouteAllowedForSubdomain, SubdomainApp } from "@/lib/subdomain";

interface SubdomainGuardProps {
  children: ReactNode;
}

/**
 * Wraps the app routes and enforces subdomain-based access control.
 * - Redirects to the correct default route on first load if on root "/"
 * - Blocks navigation to routes not allowed for the current subdomain
 */
export function SubdomainGuard({ children }: SubdomainGuardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const subdomainApp = detectSubdomainApp();

  useEffect(() => {
    if (!subdomainApp) return; // Dev mode — no restrictions

    // www.gasfacilpro.com.br → redirect to app.gasfacilpro.com.br
    if (subdomainApp === "landing") {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.startsWith("www.")) {
        const appUrl = hostname.replace(/^www\./, "app.");
        window.location.href = `${window.location.protocol}//${appUrl}${window.location.pathname}${window.location.search}`;
        return;
      }
    }

    const { pathname } = location;

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
  }, [location.pathname, subdomainApp, navigate]);

  return <>{children}</>;
}

/**
 * Hook to get the current subdomain app context
 */
export function useSubdomainApp(): SubdomainApp {
  return detectSubdomainApp();
}
