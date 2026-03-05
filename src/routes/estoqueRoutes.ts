import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Estoque = lazy(() => import("@/pages/Estoque"));
const Entregas = lazy(() => import("@/pages/Entregas"));
const Compras = lazy(() => import("@/pages/estoque/Compras"));
const Comodatos = lazy(() => import("@/pages/estoque/Comodatos"));
const DashboardEstoque = lazy(() => import("@/pages/estoque/DashboardEstoque"));
const HistoricoMovimentacoes = lazy(() => import("@/pages/estoque/HistoricoMovimentacoes"));
const MCMM = lazy(() => import("@/pages/estoque/MCMM"));
const TransferenciaEstoque = lazy(() => import("@/pages/estoque/TransferenciaEstoque"));
const LotesRastreabilidade = lazy(() => import("@/pages/estoque/LotesRastreabilidade"));

export const estoqueRoutes: RouteConfig[] = [
  { path: "/estoque/dashboard", component: DashboardEstoque, roles: ["admin", "gestor", "operacional"] },
  { path: "/estoque", component: Estoque, roles: ["admin", "gestor", "operacional"] },
  { path: "/estoque/compras", component: Compras, roles: ["admin", "gestor", "operacional"] },
  { path: "/estoque/comodatos", component: Comodatos, roles: ["admin", "gestor", "operacional"] },
  { path: "/estoque/mcmm", component: MCMM, roles: ["admin", "gestor"] },
  { path: "/estoque/historico", component: HistoricoMovimentacoes, roles: ["admin", "gestor", "operacional"] },
  { path: "/estoque/transferencia", component: TransferenciaEstoque, roles: ["admin", "gestor", "operacional"] },
  { path: "/estoque/lotes", component: LotesRastreabilidade, roles: ["admin", "gestor", "operacional"] },
  { path: "/entregas", component: Entregas, roles: ["admin", "gestor", "operacional"] },
];
