import { lazy } from "react";
import { RouteConfig } from "./helpers";

const DashboardMarketing = lazy(() => import("@/pages/marketing/DashboardMarketing"));
const RedesSociais = lazy(() => import("@/pages/marketing/RedesSociais"));
const BibliotecaConteudos = lazy(() => import("@/pages/marketing/BibliotecaConteudos"));
const AgendamentoPosts = lazy(() => import("@/pages/marketing/AgendamentoPosts"));
const AtendimentoIA = lazy(() => import("@/pages/marketing/AtendimentoIA"));

export const marketingRoutes: RouteConfig[] = [
  { path: "/marketing", component: DashboardMarketing, roles: ["admin", "gestor"] },
  { path: "/marketing/redes-sociais", component: RedesSociais, roles: ["admin", "gestor"] },
  { path: "/marketing/conteudos", component: BibliotecaConteudos, roles: ["admin", "gestor"] },
  { path: "/marketing/agendamentos", component: AgendamentoPosts, roles: ["admin", "gestor"] },
  { path: "/marketing/atendimento", component: AtendimentoIA, roles: ["admin", "gestor"] },
];
