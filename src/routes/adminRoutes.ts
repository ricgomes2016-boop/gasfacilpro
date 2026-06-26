import { lazy } from "react";
import { RouteConfig } from "./helpers";

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminEmpresas = lazy(() => import("@/pages/admin/AdminEmpresas"));
const AdminUnidades = lazy(() => import("@/pages/admin/AdminUnidades"));
const AdminAdmins = lazy(() => import("@/pages/admin/AdminAdmins"));
const AdminWhatsAppConfig = lazy(() => import("@/pages/admin/AdminWhatsAppConfig"));
const AdminDiagnosticoWhatsApp = lazy(() => import("@/pages/admin/AdminDiagnosticoWhatsApp"));
const AdminMetaIntegracoes = lazy(() => import("@/pages/admin/AdminMetaIntegracoes"));
const AdminBiaVoz = lazy(() => import("@/pages/admin/AdminBiaVoz"));
const AdminChamadasRecebidas = lazy(() => import("@/pages/admin/AdminChamadasRecebidas"));
const AdminPlanosModulos = lazy(() => import("@/pages/admin/AdminPlanosModulos"));

export const adminRoutes: RouteConfig[] = [
  { path: "/admin", component: AdminDashboard, roles: ["super_admin"] },
  { path: "/admin/empresas", component: AdminEmpresas, roles: ["super_admin"] },
  { path: "/admin/unidades", component: AdminUnidades, roles: ["super_admin"] },
  { path: "/admin/admins", component: AdminAdmins, roles: ["super_admin"] },
  { path: "/admin/whatsapp-config", component: AdminWhatsAppConfig, roles: ["super_admin"] },
  { path: "/admin/diagnostico-whatsapp", component: AdminDiagnosticoWhatsApp, roles: ["super_admin"] },
  { path: "/admin/meta-integracoes", component: AdminMetaIntegracoes, roles: ["super_admin"] },
  { path: "/admin/bia-voz", component: AdminBiaVoz, roles: ["super_admin"] },
  { path: "/admin/chamadas-recebidas", component: AdminChamadasRecebidas, roles: ["super_admin"] },
  { path: "/admin/planos-modulos", component: AdminPlanosModulos, roles: ["super_admin"] },
];
