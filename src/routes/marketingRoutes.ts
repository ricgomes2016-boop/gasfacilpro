import { lazy } from "react";
import { RouteConfig } from "./helpers";

const BibliotecaConteudos = lazy(() => import("@/pages/marketing/BibliotecaConteudos"));
const AgendamentoPosts = lazy(() => import("@/pages/marketing/AgendamentoPosts"));
const ConfigMarketing = lazy(() => import("@/pages/marketing/ConfigMarketing"));

// DashboardMarketing kept for backward compat but removed from menu
const DashboardMarketing = lazy(() => import("@/pages/marketing/DashboardMarketing"));

export const marketingRoutes: RouteConfig[] = [
  { path: "/marketing", component: DashboardMarketing, roles: ["admin", "gestor"] },
  { path: "/marketing/conteudos", component: BibliotecaConteudos, roles: ["admin", "gestor"] },
  { path: "/marketing/agendamentos", component: AgendamentoPosts, roles: ["admin", "gestor"] },
  { path: "/marketing/campanhas", component: lazy(() => import("@/pages/clientes/Campanhas")), roles: ["admin", "gestor"] },
  { path: "/marketing/configuracoes", component: ConfigMarketing, roles: ["admin", "gestor"] },
];
