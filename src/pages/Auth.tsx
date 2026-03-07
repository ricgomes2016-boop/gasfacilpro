import { lazy } from "react";
import { detectSubdomainApp } from "@/lib/subdomain";

// Lazy load subdomain-specific auth pages
const AuthErp = lazy(() => import("./auth/AuthErp"));
const AuthPainel = lazy(() => import("./auth/AuthPainel"));
const AuthCliente = lazy(() => import("./auth/AuthCliente"));
const AuthEntregador = lazy(() => import("./auth/AuthEntregador"));
const AuthParceiro = lazy(() => import("./auth/AuthParceiro"));
const AuthApi = lazy(() => import("./auth/AuthApi"));

/**
 * Smart Auth router — renders the appropriate login page based on subdomain.
 * Falls back to AuthErp in dev/preview environments.
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
    case "api":
      return <AuthApi />;
    default:
      // Dev/preview — show ERP login (full system access for development)
      return <AuthErp />;
  }
}
