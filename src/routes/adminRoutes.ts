import { lazy } from "react";
import { RouteConfig } from "./helpers";

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminEmpresas = lazy(() => import("@/pages/admin/AdminEmpresas"));
const AdminUnidades = lazy(() => import("@/pages/admin/AdminUnidades"));
const AdminAdmins = lazy(() => import("@/pages/admin/AdminAdmins"));

export const adminRoutes: RouteConfig[] = [
  { path: "/admin", component: AdminDashboard, roles: ["super_admin"] },
  { path: "/admin/empresas", component: AdminEmpresas, roles: ["super_admin"] },
  { path: "/admin/unidades", component: AdminUnidades, roles: ["super_admin"] },
  { path: "/admin/admins", component: AdminAdmins, roles: ["super_admin"] },
];
