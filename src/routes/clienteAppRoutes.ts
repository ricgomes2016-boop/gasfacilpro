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
  { path: "/cliente", component: ClienteHome, public: true },
  { path: "/cliente/cadastro", component: ClienteCadastro, public: true },
  { path: "/cliente/carrinho", component: ClienteCarrinho, public: true },
  { path: "/cliente/checkout", component: ClienteCheckout, public: true },
  { path: "/cliente/indicacao", component: ClienteIndicacao, public: true },
  { path: "/cliente/carteira", component: ClienteCarteira, public: true },
  { path: "/cliente/vale-gas", component: ClienteValeGas, public: true },
  { path: "/cliente/historico", component: ClienteHistorico, public: true },
  { path: "/cliente/dicas", component: ClienteDicas, public: true },
  { path: "/cliente/consumo", component: ClienteConsumo, public: true },
  { path: "/cliente/perfil", component: ClientePerfil, public: true },
  { path: "/cliente/rastreamento/:orderId", component: ClienteRastreamento, public: true },
  { path: "/cliente/enderecos", component: ClienteEnderecos, public: true },
  { path: "/cliente/notificacoes", component: ClienteNotificacoes, public: true },
  { path: "/cliente/assinaturas", component: ClienteAssinaturas, public: true },
  { path: "/cliente/privacidade", component: ClienteNotificacoes, public: true },
  { path: "/cliente/ajuda", component: ClienteNotificacoes, public: true },
  { path: "/cliente/termos", component: ClienteNotificacoes, public: true },
];
