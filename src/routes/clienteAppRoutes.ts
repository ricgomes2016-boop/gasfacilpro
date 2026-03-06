import { lazy } from "react";
import { RouteConfig } from "./helpers";

const ClienteHome = lazy(() => import("@/pages/cliente/ClienteHome"));
const ClienteCadastro = lazy(() => import("@/pages/cliente/ClienteCadastro"));
const ClienteCarrinho = lazy(() => import("@/pages/cliente/ClienteCarrinho"));
const ClienteCheckout = lazy(() => import("@/pages/cliente/ClienteCheckout"));
const ClienteIndicacao = lazy(() => import("@/pages/cliente/ClienteIndicacao"));
const ClienteCarteira = lazy(() => import("@/pages/cliente/ClienteCarteira"));
const ClienteValeGas = lazy(() => import("@/pages/cliente/ClienteValeGas"));
const ClienteHistorico = lazy(() => import("@/pages/cliente/ClienteHistorico"));
const ClienteDicas = lazy(() => import("@/pages/cliente/ClienteDicas"));
const ClienteConsumo = lazy(() => import("@/pages/cliente/ClienteConsumo"));
const ClientePerfil = lazy(() => import("@/pages/cliente/ClientePerfil"));
const ClienteRastreamento = lazy(() => import("@/pages/cliente/ClienteRastreamento"));
const ClienteEnderecos = lazy(() => import("@/pages/cliente/ClienteEnderecos"));
const ClienteNotificacoes = lazy(() => import("@/pages/cliente/ClienteNotificacoes"));
const ClienteAssinaturas = lazy(() => import("@/pages/cliente/ClienteAssinaturas"));

export const clienteAppRoutes: RouteConfig[] = [
  { path: "/cliente", component: ClienteHome, roles: ["cliente"] },
  { path: "/cliente/cadastro", component: ClienteCadastro, public: true },
  { path: "/cliente/carrinho", component: ClienteCarrinho, roles: ["cliente"] },
  { path: "/cliente/checkout", component: ClienteCheckout, roles: ["cliente"] },
  { path: "/cliente/indicacao", component: ClienteIndicacao, roles: ["cliente"] },
  { path: "/cliente/carteira", component: ClienteCarteira, roles: ["cliente"] },
  { path: "/cliente/vale-gas", component: ClienteValeGas, roles: ["cliente"] },
  { path: "/cliente/historico", component: ClienteHistorico, roles: ["cliente"] },
  { path: "/cliente/dicas", component: ClienteDicas, roles: ["cliente"] },
  { path: "/cliente/consumo", component: ClienteConsumo, roles: ["cliente"] },
  { path: "/cliente/perfil", component: ClientePerfil, roles: ["cliente"] },
  { path: "/cliente/rastreamento/:orderId", component: ClienteRastreamento, roles: ["cliente"] },
  { path: "/cliente/enderecos", component: ClienteEnderecos, roles: ["cliente"] },
  { path: "/cliente/notificacoes", component: ClienteNotificacoes, roles: ["cliente"] },
  { path: "/cliente/assinaturas", component: ClienteAssinaturas, roles: ["cliente"] },
  { path: "/cliente/privacidade", component: ClienteNotificacoes, roles: ["cliente"] },
  { path: "/cliente/ajuda", component: ClienteNotificacoes, roles: ["cliente"] },
  { path: "/cliente/termos", component: ClienteNotificacoes, roles: ["cliente"] },
];
