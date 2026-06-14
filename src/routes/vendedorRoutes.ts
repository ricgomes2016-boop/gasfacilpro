import { lazy } from "react";
import { RouteConfig } from "./helpers";

const VendedorDashboard = lazy(() => import("@/pages/vendedor/VendedorDashboard"));
const VendedorNovaVenda = lazy(() => import("@/pages/vendedor/VendedorNovaVenda"));
const VendedorHistorico = lazy(() => import("@/pages/vendedor/VendedorHistorico"));
const VendedorClientes = lazy(() => import("@/pages/vendedor/VendedorClientes"));
const VendedorMetas = lazy(() => import("@/pages/vendedor/VendedorMetas"));
const VendedorAvisos = lazy(() => import("@/pages/vendedor/VendedorAvisos"));
const VendedorBolao = lazy(() => import("@/pages/vendedor/VendedorBolao"));
const VendedorPerfil = lazy(() => import("@/pages/vendedor/VendedorPerfil"));

const ROLES: ("admin" | "gestor" | "vendedor")[] = ["admin", "gestor", "vendedor"];

export const vendedorRoutes: RouteConfig[] = [
  { path: "/vendedor", component: VendedorDashboard, roles: ROLES },
  { path: "/vendedor/nova-venda", component: VendedorNovaVenda, roles: ROLES },
  { path: "/vendedor/historico", component: VendedorHistorico, roles: ROLES },
  { path: "/vendedor/clientes", component: VendedorClientes, roles: ROLES },
  { path: "/vendedor/metas", component: VendedorMetas, roles: ROLES },
  { path: "/vendedor/avisos", component: VendedorAvisos, roles: ROLES },
  { path: "/vendedor/bolao", component: VendedorBolao, roles: ROLES },
  { path: "/vendedor/perfil", component: VendedorPerfil, roles: ROLES },
];
