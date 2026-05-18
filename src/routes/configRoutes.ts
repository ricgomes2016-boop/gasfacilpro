import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const Auditoria = lazy(() => import("@/pages/config/Auditoria"));
const Permissoes = lazy(() => import("@/pages/config/Permissoes"));
const UnidadesConfig = lazy(() => import("@/pages/config/Unidades"));
const Usuarios = lazy(() => import("@/pages/config/Usuarios"));
const DocumentosEmpresa = lazy(() => import("@/pages/config/DocumentosEmpresa"));
const Notificacoes = lazy(() => import("@/pages/config/Notificacoes"));
const PersonalizacaoVisual = lazy(() => import("@/pages/config/PersonalizacaoVisual"));
const RegrasBia = lazy(() => import("@/pages/config/RegrasBia"));
const SiteInstitucional = lazy(() => import("@/pages/config/SiteInstitucional"));
const MeuPerfil = lazy(() => import("@/pages/MeuPerfil"));
const AssinaturaDigitalDiagnostico = lazy(() => import("@/pages/config/AssinaturaDigitalDiagnostico"));
const AsaasConfig = lazy(() => import("@/pages/config/AsaasConfig"));

export const configRoutes: RouteConfig[] = [
  { path: "/meu-perfil", component: MeuPerfil, roles: ["admin", "gestor", "financeiro", "operacional"] },
  { path: "/config/auditoria", component: Auditoria, roles: ["admin"] },
  { path: "/config/permissoes", component: Permissoes, roles: ["admin"] },
  { path: "/config/unidades", component: UnidadesConfig, roles: ["admin", "gestor"] },
  { path: "/config/usuarios", component: Usuarios, roles: ["admin"] },
  { path: "/configuracoes", component: Configuracoes, roles: ["admin", "gestor"] },
  { path: "/config/documentos", component: DocumentosEmpresa, roles: ["admin", "gestor", "financeiro"] },
  { path: "/config/notificacoes", component: Notificacoes, roles: ["admin", "gestor"] },
  { path: "/config/personalizacao", component: PersonalizacaoVisual, roles: ["admin", "gestor"] },
  { path: "/config/regras-bia", component: RegrasBia, roles: ["admin", "gestor"] },
  { path: "/config/site-institucional", component: SiteInstitucional, roles: ["admin", "gestor"] },
  { path: "/config/assinatura-digital", component: AssinaturaDigitalDiagnostico, roles: ["admin", "gestor", "financeiro"] },
];
