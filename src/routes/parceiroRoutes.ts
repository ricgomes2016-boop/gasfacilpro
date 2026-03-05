import { lazy } from "react";
import { RouteConfig } from "./helpers";

const ParceiroDashboard = lazy(() => import("@/pages/parceiro/ParceiroDashboard"));
const ParceiroVenderVale = lazy(() => import("@/pages/parceiro/ParceiroVenderVale"));
const ParceiroVales = lazy(() => import("@/pages/parceiro/ParceiroVales"));
const ParceiroQRCode = lazy(() => import("@/pages/parceiro/ParceiroQRCode"));

const PARCEIRO_ROLES: ("admin" | "gestor" | "parceiro")[] = ["admin", "gestor", "parceiro"];

export const parceiroRoutes: RouteConfig[] = [
  { path: "/parceiro", component: ParceiroDashboard, roles: PARCEIRO_ROLES },
  { path: "/parceiro/vender", component: ParceiroVenderVale, roles: PARCEIRO_ROLES },
  { path: "/parceiro/vales", component: ParceiroVales, roles: PARCEIRO_ROLES },
  { path: "/parceiro/qrcode", component: ParceiroQRCode, roles: PARCEIRO_ROLES },
];
