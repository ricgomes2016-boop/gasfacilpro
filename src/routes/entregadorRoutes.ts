import { lazy } from "react";
import { RouteConfig } from "./helpers";

const EntregadorDashboard = lazy(() => import("@/pages/entregador/EntregadorDashboard"));
const EntregadorEntregas = lazy(() => import("@/pages/entregador/EntregadorEntregas"));
const FinalizarEntrega = lazy(() => import("@/pages/entregador/FinalizarEntrega"));
const EntregadorNovaVenda = lazy(() => import("@/pages/entregador/EntregadorNovaVenda"));
const EntregadorDespesas = lazy(() => import("@/pages/entregador/EntregadorDespesas"));
const EntregadorCombustivel = lazy(() => import("@/pages/entregador/EntregadorCombustivel"));
const EntregadorPerfil = lazy(() => import("@/pages/entregador/EntregadorPerfil"));
const EntregadorHistorico = lazy(() => import("@/pages/entregador/EntregadorHistorico"));
const EntregadorIniciarJornada = lazy(() => import("@/pages/entregador/EntregadorIniciarJornada"));
const EntregadorConfiguracoes = lazy(() => import("@/pages/entregador/EntregadorConfiguracoes"));
const EntregadorEstoque = lazy(() => import("@/pages/entregador/EntregadorEstoque"));
const EntregadorTransferencia = lazy(() => import("@/pages/entregador/EntregadorTransferencia"));
const EntregadorConquistas = lazy(() => import("@/pages/entregador/EntregadorConquistas"));
const EntregadorProdutividade = lazy(() => import("@/pages/entregador/EntregadorProdutividade"));
const EntregadorFinanceiro = lazy(() => import("@/pages/entregador/EntregadorFinanceiro"));
const EntregadorVendas = lazy(() => import("@/pages/entregador/EntregadorVendas"));
const EntregadorTreinamento = lazy(() => import("@/pages/entregador/EntregadorTreinamento"));

const DRIVER_ROLES: ("admin" | "gestor" | "entregador")[] = ["admin", "gestor", "entregador"];

export const entregadorRoutes: RouteConfig[] = [
  { path: "/entregador", component: EntregadorDashboard, roles: DRIVER_ROLES },
  { path: "/entregador/jornada", component: EntregadorIniciarJornada, roles: DRIVER_ROLES },
  { path: "/entregador/entregas", component: EntregadorEntregas, roles: DRIVER_ROLES },
  { path: "/entregador/entregas/:id/finalizar", component: FinalizarEntrega, roles: DRIVER_ROLES },
  { path: "/entregador/nova-venda", component: EntregadorNovaVenda, roles: DRIVER_ROLES },
  { path: "/entregador/despesas", component: EntregadorDespesas, roles: DRIVER_ROLES },
  { path: "/entregador/combustivel", component: EntregadorCombustivel, roles: DRIVER_ROLES },
  { path: "/entregador/historico", component: EntregadorHistorico, roles: DRIVER_ROLES },
  { path: "/entregador/perfil", component: EntregadorPerfil, roles: DRIVER_ROLES },
  { path: "/entregador/configuracoes", component: EntregadorConfiguracoes, roles: DRIVER_ROLES },
  { path: "/entregador/estoque", component: EntregadorEstoque, roles: DRIVER_ROLES },
  { path: "/entregador/transferencia", component: EntregadorTransferencia, roles: DRIVER_ROLES },
  { path: "/entregador/conquistas", component: EntregadorConquistas, roles: DRIVER_ROLES },
  { path: "/entregador/produtividade", component: EntregadorProdutividade, roles: DRIVER_ROLES },
  { path: "/entregador/financeiro", component: EntregadorFinanceiro, roles: DRIVER_ROLES },
  { path: "/entregador/vendas", component: EntregadorVendas, roles: DRIVER_ROLES },
  { path: "/entregador/treinamento", component: EntregadorTreinamento, roles: DRIVER_ROLES },
];
