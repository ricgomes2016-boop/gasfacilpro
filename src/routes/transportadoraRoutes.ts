import { lazy } from "react";
import { RouteConfig } from "./helpers";

const TranspDashboard = lazy(() => import("@/pages/transportadora/TranspDashboard"));
const TranspVeiculos = lazy(() => import("@/pages/transportadora/TranspVeiculos"));
const TranspFuncionarios = lazy(() => import("@/pages/transportadora/TranspFuncionarios"));
const TranspSimulacao = lazy(() => import("@/pages/transportadora/TranspSimulacao"));
const TranspAbastecimento = lazy(() => import("@/pages/transportadora/TranspAbastecimento"));
const TranspLancamento = lazy(() => import("@/pages/transportadora/TranspLancamento"));
const TranspEntregas = lazy(() => import("@/pages/transportadora/TranspEntregas"));
const TranspIA = lazy(() => import("@/pages/transportadora/TranspIA"));
const TranspRelatorios = lazy(() => import("@/pages/transportadora/TranspRelatorios"));
const TranspRotaAtacado = lazy(() => import("@/pages/transportadora/TranspRotaAtacado"));

const TRANSP_ROLES: ("admin" | "gestor" | "transportadora")[] = ["admin", "gestor", "transportadora"];

export const transportadoraRoutes: RouteConfig[] = [
  { path: "/transportadora", component: TranspDashboard, roles: TRANSP_ROLES },
  { path: "/transportadora/veiculos", component: TranspVeiculos, roles: TRANSP_ROLES },
  { path: "/transportadora/funcionarios", component: TranspFuncionarios, roles: TRANSP_ROLES },
  { path: "/transportadora/simulacao", component: TranspSimulacao, roles: TRANSP_ROLES },
  { path: "/transportadora/rota-atacado", component: TranspRotaAtacado, roles: TRANSP_ROLES },
  { path: "/transportadora/abastecimento", component: TranspAbastecimento, roles: TRANSP_ROLES },
  { path: "/transportadora/lancamento", component: TranspLancamento, roles: TRANSP_ROLES },
  { path: "/transportadora/entregas", component: TranspEntregas, roles: TRANSP_ROLES },
  { path: "/transportadora/ia", component: TranspIA, roles: TRANSP_ROLES },
  { path: "/transportadora/relatorios", component: TranspRelatorios, roles: TRANSP_ROLES },
];
