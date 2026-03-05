import { lazy } from "react";
import { RouteConfig } from "./helpers";

const DashboardFiscal = lazy(() => import("@/pages/fiscal/DashboardFiscal"));
const EmitirNFe = lazy(() => import("@/pages/fiscal/EmitirNFe"));
const EmitirNFCe = lazy(() => import("@/pages/fiscal/EmitirNFCe"));
const EmitirMDFe = lazy(() => import("@/pages/fiscal/EmitirMDFe"));
const EmitirCTe = lazy(() => import("@/pages/fiscal/EmitirCTe"));
const GerarXML = lazy(() => import("@/pages/fiscal/GerarXML"));
const RelatoriosNotas = lazy(() => import("@/pages/fiscal/RelatoriosNotas"));

const FISCAL_ROLES: ("admin" | "gestor" | "financeiro" | "operacional")[] = ["admin", "gestor", "financeiro", "operacional"];
const FISCAL_OPS: ("admin" | "gestor" | "operacional")[] = ["admin", "gestor", "operacional"];

export const fiscalRoutes: RouteConfig[] = [
  { path: "/fiscal", component: DashboardFiscal, roles: FISCAL_ROLES },
  { path: "/fiscal/nfe", component: EmitirNFe, roles: FISCAL_OPS },
  { path: "/fiscal/nfce", component: EmitirNFCe, roles: FISCAL_OPS },
  { path: "/fiscal/mdfe", component: EmitirMDFe, roles: FISCAL_OPS },
  { path: "/fiscal/cte", component: EmitirCTe, roles: FISCAL_OPS },
  { path: "/fiscal/xml", component: GerarXML, roles: FISCAL_OPS },
  { path: "/fiscal/relatorios", component: RelatoriosNotas, roles: FISCAL_OPS },
];
