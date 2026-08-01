import { lazy } from "react";
import { Navigate, useParams } from "react-router-dom";
import { RouteConfig } from "./helpers";

const CadastroClientes = lazy(() => import("@/pages/clientes/CadastroClientes"));
const ClientePerfilPage = lazy(() => import("@/pages/clientes/ClientePerfilPage"));
const Campanhas = lazy(() => import("@/pages/clientes/Campanhas"));
const PromocoesCupons = lazy(() => import("@/pages/clientes/PromocoesCupons"));
const Fidelidade = lazy(() => import("@/pages/clientes/Fidelidade"));
const CRM = lazy(() => import("@/pages/clientes/CRM"));
const RankingClientes = lazy(() => import("@/pages/clientes/RankingClientes"));
const MarketingIA = lazy(() => import("@/pages/clientes/MarketingIA"));
const GestaoCredito = lazy(() => import("@/pages/clientes/GestaoCredito"));
const ContratosRecorrentes = lazy(() => import("@/pages/clientes/ContratosRecorrentes"));
const ProgramaIndicacao = lazy(() => import("@/pages/clientes/ProgramaIndicacao"));
const AplicativoCliente = lazy(() => import("@/pages/clientes/AplicativoCliente"));

// Compatibilidade: redireciona URLs antigas /clientes/:id -> /clientes/cadastro/:id
function ClientePerfilRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/clientes/cadastro/${id}`} replace />;
}

export const clientesRoutes: RouteConfig[] = [
  { path: "/clientes/cadastro", component: CadastroClientes, roles: ["admin", "gestor", "operacional"] },
  { path: "/whatsapp/contatos", component: CadastroClientes, roles: ["admin", "gestor", "operacional"] },
  { path: "/clientes/cadastro/:id", component: ClientePerfilPage, roles: ["admin", "gestor", "operacional"] },
  { path: "/clientes/:id", component: ClientePerfilRedirect, roles: ["admin", "gestor", "operacional"] },
  { path: "/clientes/promocoes", component: PromocoesCupons, roles: ["admin", "gestor"] },
  { path: "/clientes/marketing", component: MarketingIA, roles: ["admin", "gestor"] },
  { path: "/clientes/campanhas", component: Campanhas, roles: ["admin", "gestor"] },
  { path: "/clientes/fidelidade", component: Fidelidade, roles: ["admin", "gestor"] },
  { path: "/clientes/crm", component: CRM, roles: ["admin", "gestor"] },
  { path: "/clientes/ranking", component: RankingClientes, roles: ["admin", "gestor"] },
  { path: "/clientes/credito", component: GestaoCredito, roles: ["admin", "gestor", "financeiro"] },
  { path: "/clientes/contratos", component: ContratosRecorrentes, roles: ["admin", "gestor", "operacional"] },
  { path: "/clientes/indicacao", component: ProgramaIndicacao, roles: ["admin", "gestor", "operacional"] },
  { path: "/clientes/aplicativo", component: AplicativoCliente, roles: ["admin", "gestor"] },
];
