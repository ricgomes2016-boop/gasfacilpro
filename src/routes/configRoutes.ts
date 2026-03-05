import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const Auditoria = lazy(() => import("@/pages/config/Auditoria"));
const Permissoes = lazy(() => import("@/pages/config/Permissoes"));
const UnidadesConfig = lazy(() => import("@/pages/config/Unidades"));
const Usuarios = lazy(() => import("@/pages/config/Usuarios"));
const DocumentosEmpresa = lazy(() => import("@/pages/config/DocumentosEmpresa"));
const Notificacoes = lazy(() => import("@/pages/config/Notificacoes"));
const Integracoes = lazy(() => import("@/pages/config/Integracoes"));
const PersonalizacaoVisual = lazy(() => import("@/pages/config/PersonalizacaoVisual"));
const MinhaEmpresa = lazy(() => import("@/pages/config/MinhaEmpresa"));

export const configRoutes: RouteConfig[] = [
  { path: "/config/empresa", component: MinhaEmpresa, roles: ["admin"] },
  { path: "/config/auditoria", component: Auditoria, roles: ["admin"] },
  { path: "/config/permissoes", component: Permissoes, roles: ["admin"] },
  { path: "/config/unidades", component: UnidadesConfig, roles: ["admin", "gestor"] },
  { path: "/config/usuarios", component: Usuarios, roles: ["admin"] },
  { path: "/configuracoes", component: Configuracoes, roles: ["admin", "gestor"] },
  { path: "/config/documentos", component: DocumentosEmpresa, roles: ["admin", "gestor", "financeiro"] },
  { path: "/config/notificacoes", component: Notificacoes, roles: ["admin", "gestor"] },
  { path: "/config/integracoes", component: Integracoes, roles: ["admin", "gestor"] },
  { path: "/config/personalizacao", component: PersonalizacaoVisual, roles: ["admin", "gestor"] },
];
