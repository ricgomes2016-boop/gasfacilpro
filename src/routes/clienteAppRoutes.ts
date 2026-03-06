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
  { path: "/cliente", component: ClienteHome },
  { path: "/cliente/cadastro", component: ClienteCadastro, public: true },
  { path: "/cliente/carrinho", component: ClienteCarrinho },
  { path: "/cliente/checkout", component: ClienteCheckout },
  { path: "/cliente/indicacao", component: ClienteIndicacao },
  { path: "/cliente/carteira", component: ClienteCarteira },
  { path: "/cliente/vale-gas", component: ClienteValeGas },
  { path: "/cliente/historico", component: ClienteHistorico },
  { path: "/cliente/dicas", component: ClienteDicas },
  { path: "/cliente/consumo", component: ClienteConsumo },
  { path: "/cliente/perfil", component: ClientePerfil },
  { path: "/cliente/rastreamento/:orderId", component: ClienteRastreamento },
  { path: "/cliente/enderecos", component: ClienteEnderecos },
  { path: "/cliente/notificacoes", component: ClienteNotificacoes },
  { path: "/cliente/assinaturas", component: ClienteAssinaturas },
  { path: "/cliente/privacidade", component: ClienteNotificacoes },
  { path: "/cliente/ajuda", component: ClienteNotificacoes },
  { path: "/cliente/termos", component: ClienteNotificacoes },
];
