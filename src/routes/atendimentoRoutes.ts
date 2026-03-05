import { lazy } from "react";
import { RouteConfig } from "./helpers";

const CentralAtendimento = lazy(() => import("@/pages/atendimento/CentralAtendimento"));
const AppBina = lazy(() => import("@/pages/atendimento/AppBina"));
const AssistenteIA = lazy(() => import("@/pages/AssistenteIA"));

export const atendimentoRoutes: RouteConfig[] = [
  { path: "/atendimento", component: CentralAtendimento, roles: ["admin", "gestor", "operacional"] },
  { path: "/atendimento/bina", component: AppBina, roles: ["admin", "gestor", "operacional"] },
  { path: "/assistente-ia", component: AssistenteIA, roles: ["admin", "gestor"] },
];
