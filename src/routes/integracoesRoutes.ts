import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Integracoes = lazy(() => import("@/pages/Integracoes"));
const WhatsAppCredenciais = lazy(() => import("@/pages/WhatsAppCredenciais"));

export const integracoesRoutes: RouteConfig[] = [
  { path: "/integracoes", component: Integracoes, roles: ["admin", "gestor"] },
  { path: "/whatsapp/credenciais", component: WhatsAppCredenciais, roles: ["admin", "gestor"] },
];
