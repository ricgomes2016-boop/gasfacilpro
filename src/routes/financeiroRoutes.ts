import { lazy } from "react";
import { RouteConfig } from "./helpers";

const DashboardFinanceiro = lazy(() => import("@/pages/financeiro/DashboardFinanceiro"));
const AgingReport = lazy(() => import("@/pages/financeiro/AgingReport"));
const FluxoCaixaProjetado = lazy(() => import("@/pages/financeiro/FluxoCaixaProjetado"));
const ContasPagar = lazy(() => import("@/pages/financeiro/ContasPagar"));
const ContasReceber = lazy(() => import("@/pages/financeiro/ContasReceber"));
const AprovarDespesas = lazy(() => import("@/pages/financeiro/AprovarDespesas"));
const Conciliacao = lazy(() => import("@/pages/financeiro/Conciliacao"));
const Contador = lazy(() => import("@/pages/financeiro/Contador"));
const ContadorHome = lazy(() => import("@/pages/contador/ContadorHome"));
const ContadorCalendario = lazy(() => import("@/pages/contador/ContadorCalendario"));
const ContadorSolicitacoes = lazy(() => import("@/pages/contador/ContadorSolicitacoes"));
const ContadorComunicados = lazy(() => import("@/pages/contador/ContadorComunicados"));
const TerminaisCartao = lazy(() => import("@/pages/financeiro/TerminaisCartao"));
const GestaoCartoes = lazy(() => import("@/pages/financeiro/GestaoCartoes"));
const PagamentosCartao = lazy(() => import("@/pages/financeiro/PagamentosCartao"));
const Cobrancas = lazy(() => import("@/pages/financeiro/Cobrancas"));
const CalendarioFinanceiro = lazy(() => import("@/pages/financeiro/CalendarioFinanceiro"));
const ValeGas = lazy(() => import("@/pages/financeiro/ValeGas"));
const Orcamentos = lazy(() => import("@/pages/financeiro/Orcamentos"));
const ContasBancarias = lazy(() => import("@/pages/financeiro/ContasBancarias"));
const ControleCheques = lazy(() => import("@/pages/financeiro/ControleCheques"));
const VendaAntecipada = lazy(() => import("@/pages/financeiro/VendaAntecipada"));
const BalancoPatrimonial = lazy(() => import("@/pages/financeiro/BalancoPatrimonial"));
const EmailTransacional = lazy(() => import("@/pages/financeiro/EmailTransacional"));
const ExportacaoContabil = lazy(() => import("@/pages/financeiro/ExportacaoContabil"));
const FechamentoMensal = lazy(() => import("@/pages/financeiro/FechamentoMensal"));

const FINANCE_ROLES: ("admin" | "gestor" | "financeiro")[] = ["admin", "gestor", "financeiro"];
const CONTADOR_ROLES: ("admin" | "gestor" | "financeiro" | "contador")[] = ["admin", "gestor", "financeiro", "contador"];

export const financeiroRoutes: RouteConfig[] = [
  { path: "/financeiro", component: DashboardFinanceiro, roles: FINANCE_ROLES },
  { path: "/financeiro/aging", component: AgingReport, roles: FINANCE_ROLES },
  { path: "/financeiro/fluxo", component: FluxoCaixaProjetado, roles: FINANCE_ROLES },
  { path: "/financeiro/pagar", component: ContasPagar, roles: FINANCE_ROLES },
  { path: "/financeiro/receber", component: ContasReceber, roles: FINANCE_ROLES },
  { path: "/financeiro/aprovar", component: AprovarDespesas, roles: ["admin", "gestor"] },
  { path: "/financeiro/conciliacao", component: Conciliacao, roles: FINANCE_ROLES },
  { path: "/financeiro/contador", component: ContadorHome, roles: CONTADOR_ROLES },
  { path: "/financeiro/contador/calendario", component: ContadorCalendario, roles: CONTADOR_ROLES },
  { path: "/financeiro/contador/documentos", component: Contador, roles: CONTADOR_ROLES },
  { path: "/financeiro/contador/solicitacoes", component: ContadorSolicitacoes, roles: CONTADOR_ROLES },
  { path: "/financeiro/contador/comunicados", component: ContadorComunicados, roles: CONTADOR_ROLES },
  { path: "/financeiro/orcamentos", component: Orcamentos, roles: ["admin", "gestor", "financeiro", "operacional"] },
  { path: "/financeiro/terminais", component: TerminaisCartao, roles: FINANCE_ROLES },
  { path: "/financeiro/cartoes", component: GestaoCartoes, roles: FINANCE_ROLES },
  { path: "/financeiro/pagamentos-cartao", component: PagamentosCartao, roles: FINANCE_ROLES },
  { path: "/financeiro/cobrancas", component: Cobrancas, roles: FINANCE_ROLES },
  { path: "/financeiro/boletos", component: Cobrancas, roles: FINANCE_ROLES },
  { path: "/financeiro/calendario", component: CalendarioFinanceiro, roles: FINANCE_ROLES },
  { path: "/financeiro/vale-gas", component: ValeGas, roles: FINANCE_ROLES },
  { path: "/financeiro/vale-gas/*", component: ValeGas, roles: FINANCE_ROLES },
  { path: "/financeiro/contas-bancarias", component: ContasBancarias, roles: FINANCE_ROLES },
  { path: "/financeiro/cheques", component: ControleCheques, roles: FINANCE_ROLES },
  { path: "/financeiro/venda-antecipada", component: VendaAntecipada, roles: FINANCE_ROLES },
  { path: "/financeiro/email-transacional", component: EmailTransacional, roles: FINANCE_ROLES },
  { path: "/financeiro/exportacao-contabil", component: ExportacaoContabil, roles: FINANCE_ROLES },
  { path: "/financeiro/balanco", component: BalancoPatrimonial, roles: FINANCE_ROLES },
  { path: "/financeiro/fechamento", component: FechamentoMensal, roles: FINANCE_ROLES },
];
