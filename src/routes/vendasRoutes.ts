import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Vendas = lazy(() => import("@/pages/Vendas"));
const NovaVenda = lazy(() => import("@/pages/vendas/NovaVenda"));
const PedidosKanban = lazy(() => import("@/pages/vendas/PedidosKanban"));
const Pedidos = lazy(() => import("@/pages/vendas/Pedidos"));
const EditarPedido = lazy(() => import("@/pages/vendas/EditarPedido"));
const PDV = lazy(() => import("@/pages/vendas/PDV"));
const RelatorioVendas = lazy(() => import("@/pages/vendas/RelatorioDetalhadoVendas"));
const RelatorioLucratividade = lazy(() => import("@/pages/vendas/RelatorioLucratividade"));
const Devolucoes = lazy(() => import("@/pages/vendas/Devolucoes"));

export const vendasRoutes: RouteConfig[] = [
  { path: "/vendas", component: Vendas, roles: ["admin", "gestor", "operacional", "entregador"] },
  { path: "/vendas/nova", component: NovaVenda, roles: ["admin", "gestor", "operacional", "entregador"] },
  { path: "/vendas/pedidos", component: Pedidos, roles: ["admin", "gestor", "operacional", "entregador"] },
  { path: "/vendas/pedidos/kanban", component: PedidosKanban, roles: ["admin", "gestor", "operacional", "entregador"] },
  { path: "/vendas/pedidos/:id/editar", component: EditarPedido, roles: ["admin", "gestor", "operacional"] },
  { path: "/vendas/pdv", component: PDV, roles: ["admin", "gestor", "operacional"] },
  { path: "/vendas/relatorio", component: RelatorioVendas, roles: ["admin", "gestor", "financeiro"] },
  { path: "/vendas/devolucoes", component: Devolucoes, roles: ["admin", "gestor", "operacional"] },
];
