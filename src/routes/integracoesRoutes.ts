import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Integracoes = lazy(() => import("@/pages/Integracoes"));
const WhatsAppGateway = lazy(() => import("@/pages/integracoes/WhatsAppGateway"));

export const integracoesRoutes: RouteConfig[] = [
  { path: "/integracoes", component: Integracoes, roles: ["admin", "gestor"] },
  { path: "/integracoes/whatsapp-gateway", component: WhatsAppGateway, roles: ["admin", "gestor"] },
];
