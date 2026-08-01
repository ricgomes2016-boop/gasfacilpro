import { lazy } from "react";
import { RouteConfig } from "./helpers";

const CentralAtendimento = lazy(() => import("@/pages/atendimento/CentralAtendimento"));
const RegistroAtendimento = lazy(() => import("@/pages/atendimento/RegistroAtendimento"));
const LigacaoIA = lazy(() => import("@/pages/atendimento/LigacaoIA"));
const AppBina = lazy(() => import("@/pages/atendimento/AppBina"));
const AssistenteIA = lazy(() => import("@/pages/AssistenteIA"));
const CaixaDeEntrada = lazy(() => import("@/pages/atendimento/CaixaDeEntrada"));
const WhatsappDashboard = lazy(() => import("@/pages/WhatsappDashboard"));
const WhatsappAdmin = lazy(() => import("@/pages/WhatsappAdmin"));
const WhatsAppWebLogin = lazy(() => import("@/pages/WhatsAppWebLogin"));
const WhatsAppWebDashboard = lazy(() => import("@/pages/WhatsAppWebDashboard"));

export const atendimentoRoutes: RouteConfig[] = [
  { path: "/atendimento", component: CentralAtendimento, roles: ["admin", "gestor", "operacional"] },
  { path: "/atendimento/registro", component: RegistroAtendimento, roles: ["admin", "gestor", "operacional"] },
  { path: "/atendimento/ligacao-ia", component: LigacaoIA, roles: ["admin", "gestor", "operacional"] },
  { path: "/atendimento/bina", component: AppBina, roles: ["admin", "gestor", "operacional"] },
  { path: "/chat", component: CaixaDeEntrada, roles: ["admin", "gestor", "operacional"] },
  { path: "/assistente-ia", component: AssistenteIA, roles: ["admin", "gestor", "super_admin"] },
  { path: "/whatsapp", component: WhatsappDashboard, roles: ["admin", "gestor", "operacional"] },
  { path: "/whatsapp/admin", component: WhatsappAdmin, roles: ["admin"] },
  { path: "/whatsapp/web/login", component: WhatsAppWebLogin, roles: ["admin", "gestor", "operacional"] },
  { path: "/whatsapp/web", component: WhatsAppWebDashboard, roles: ["admin", "gestor", "operacional"] },
];
