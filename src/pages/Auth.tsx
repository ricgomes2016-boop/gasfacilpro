import { lazy } from "react";
import { detectSubdomainApp } from "@/lib/subdomain";

const AuthErp = lazy(() => import("./auth/AuthErp"));
const AuthPainel = lazy(() => import("./auth/AuthPainel"));
const AuthCliente = lazy(() => import("./auth/AuthCliente"));
const AuthEntregador = lazy(() => import("./auth/AuthEntregador"));
const AuthParceiro = lazy(() => import("./auth/AuthParceiro"));
const AuthTransportadora = lazy(() => import("./auth/AuthTransportadora"));
const AuthApi = lazy(() => import("./auth/AuthApi"));
const AuthContador = lazy(() => import("./auth/AuthContador"));
const AuthVendedor = lazy(() => import("./auth/AuthVendedor"));

export default function Auth() {
  const app = detectSubdomainApp();

  switch (app) {
    case "erp": return <AuthErp />;
    case "painel": return <AuthPainel />;
    case "cliente": return <AuthCliente />;
    case "entregador": return <AuthEntregador />;
    case "parceiro": return <AuthParceiro />;
    case "transportadora": return <AuthTransportadora />;
    case "api": return <AuthApi />;
    case "contador": return <AuthContador />;
    case "vendedor": return <AuthVendedor />;
    default:
      return <AuthErp />;
  }
}
