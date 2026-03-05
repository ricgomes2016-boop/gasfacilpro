import { lazy } from "react";
import { RouteConfig } from "./helpers";

const DashboardFrota = lazy(() => import("@/pages/frota/DashboardFrota"));
const Combustivel = lazy(() => import("@/pages/frota/Combustivel"));
const Manutencao = lazy(() => import("@/pages/frota/Manutencao"));
const RelatoriosFrota = lazy(() => import("@/pages/frota/RelatoriosFrota"));
const Gamificacao = lazy(() => import("@/pages/frota/Gamificacao"));
const DocumentosFrota = lazy(() => import("@/pages/frota/DocumentosFrota"));
const ChecklistSaida = lazy(() => import("@/pages/frota/ChecklistSaida"));
const MultasFrota = lazy(() => import("@/pages/frota/MultasFrota"));

export const frotaRoutes: RouteConfig[] = [
  { path: "/frota", component: DashboardFrota, roles: ["admin", "gestor"] },
  { path: "/frota/combustivel", component: Combustivel, roles: ["admin", "gestor", "operacional"] },
  { path: "/frota/manutencao", component: Manutencao, roles: ["admin", "gestor"] },
  { path: "/frota/relatorios", component: RelatoriosFrota, roles: ["admin", "gestor"] },
  { path: "/frota/gamificacao", component: Gamificacao, roles: ["admin", "gestor"] },
  { path: "/frota/documentos", component: DocumentosFrota, roles: ["admin", "gestor"] },
  { path: "/frota/checklist", component: ChecklistSaida, roles: ["admin", "gestor", "operacional"] },
  { path: "/frota/multas", component: MultasFrota, roles: ["admin", "gestor"] },
];
