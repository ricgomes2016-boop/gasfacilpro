import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Integracoes = lazy(() => import("@/pages/Integracoes"));

export const integracoesRoutes: RouteConfig[] = [
  { path: "/integracoes", component: Integracoes, roles: ["admin", "gestor"] },
];
