import { lazy } from "react";
import { detectSubdomainApp } from "@/lib/subdomain";

// Lazy load subdomain-specific auth pages
const AuthErp = lazy(() => import("./auth/AuthErp"));
const AuthPainel = lazy(() => import("./auth/AuthPainel"));
const AuthCliente = lazy(() => import("./auth/AuthCliente"));
const AuthEntregador = lazy(() => import("./auth/AuthEntregador"));
const AuthParceiro = lazy(() => import("./auth/AuthParceiro"));

/**
 * Smart Auth router — renders the appropriate login page based on subdomain.
 * Falls back to AuthCliente (with signup) in dev/preview environments.
 */
export default function Auth() {
  const app = detectSubdomainApp();

  switch (app) {
    case "erp":
      return <AuthErp />;
    case "painel":
      return <AuthPainel />;
    case "cliente":
      return <AuthCliente />;
    case "entregador":
      return <AuthEntregador />;
    case "parceiro":
      return <AuthParceiro />;
    default:
      // Dev/preview or unrecognized — show full auth with signup (original behavior)
      return <AuthCliente />;
  }
}
