import { lazy } from "react";
import { RouteConfig } from "./helpers";

const AcertoEntregador = lazy(() => import("@/pages/caixa/AcertoEntregador"));
const CaixaDia = lazy(() => import("@/pages/caixa/CaixaDia"));
const Despesas = lazy(() => import("@/pages/caixa/Despesas"));

export const caixaRoutes: RouteConfig[] = [
  { path: "/caixa/acerto", component: AcertoEntregador, roles: ["admin", "gestor", "financeiro"] },
  { path: "/caixa/dia", component: CaixaDia, roles: ["admin", "gestor", "financeiro"] },
  { path: "/caixa/despesas", component: Despesas, roles: ["admin", "gestor", "financeiro"] },
];
