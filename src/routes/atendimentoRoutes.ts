import { lazy } from "react";
import { RouteConfig } from "./helpers";

const CentralAtendimento = lazy(() => import("@/pages/atendimento/CentralAtendimento"));
const AppBina = lazy(() => import("@/pages/atendimento/AppBina"));
const AssistenteIA = lazy(() => import("@/pages/AssistenteIA"));
const CaixaDeEntrada = lazy(() => import("@/pages/atendimento/CaixaDeEntrada"));
const WhatsappDashboard = lazy(() => import("@/pages/WhatsappDashboard"));
const WhatsappAdmin = lazy(() => import("@/pages/WhatsappAdmin"));

export const atendimentoRoutes: RouteConfig[] = [
  { path: "/atendimento", component: CentralAtendimento, roles: ["admin", "gestor", "operacional"] },
  { path: "/atendimento/bina", component: AppBina, roles: ["admin", "gestor", "operacional"] },
  { path: "/chat", component: CaixaDeEntrada, roles: ["admin", "gestor", "operacional"] },
  { path: "/assistente-ia", component: AssistenteIA, roles: ["admin", "gestor"] },
  { path: "/whatsapp", component: WhatsappDashboard, roles: ["admin", "gestor", "operacional"] },
  { path: "/whatsapp/admin", component: WhatsappAdmin, roles: ["admin"] },
];
