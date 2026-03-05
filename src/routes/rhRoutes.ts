import { lazy } from "react";
import { RouteConfig } from "./helpers";

const FolhaPagamento = lazy(() => import("@/pages/rh/FolhaPagamento"));
const ValeFuncionario = lazy(() => import("@/pages/rh/ValeFuncionario"));
const ComissaoEntregador = lazy(() => import("@/pages/rh/ComissaoEntregador"));
const Premiacao = lazy(() => import("@/pages/rh/Premiacao"));
const Bonus = lazy(() => import("@/pages/rh/Bonus"));
const AlertaJornada = lazy(() => import("@/pages/rh/AlertaJornada"));
const BancoHoras = lazy(() => import("@/pages/rh/BancoHoras"));
const Horarios = lazy(() => import("@/pages/rh/Horarios"));
const PrevencaoTrabalhistaIA = lazy(() => import("@/pages/rh/PrevencaoTrabalhistaIA"));
const ProdutividadeIA = lazy(() => import("@/pages/rh/ProdutividadeIA"));
const Ferias = lazy(() => import("@/pages/rh/Ferias"));
const PontoEletronico = lazy(() => import("@/pages/rh/PontoEletronico"));
const AtestadosFaltas = lazy(() => import("@/pages/rh/AtestadosFaltas"));
const AvaliacaoDesempenho = lazy(() => import("@/pages/rh/AvaliacaoDesempenho"));
const OnboardingOffboarding = lazy(() => import("@/pages/rh/OnboardingOffboarding"));
const DashboardRH = lazy(() => import("@/pages/rh/DashboardRH"));

const RH_ROLES: ("admin" | "gestor")[] = ["admin", "gestor"];

export const rhRoutes: RouteConfig[] = [
  { path: "/rh/folha", component: FolhaPagamento, roles: RH_ROLES },
  { path: "/rh/vale", component: ValeFuncionario, roles: ["admin", "gestor", "financeiro"] },
  { path: "/rh/comissao", component: ComissaoEntregador, roles: ["admin", "gestor", "financeiro"] },
  { path: "/rh/premiacao", component: Premiacao, roles: RH_ROLES },
  { path: "/rh/bonus", component: Bonus, roles: RH_ROLES },
  { path: "/rh/jornada", component: AlertaJornada, roles: RH_ROLES },
  { path: "/rh/banco-horas", component: BancoHoras, roles: RH_ROLES },
  { path: "/rh/horarios", component: Horarios, roles: RH_ROLES },
  { path: "/rh/prevencao-ia", component: PrevencaoTrabalhistaIA, roles: RH_ROLES },
  { path: "/rh/produtividade-ia", component: ProdutividadeIA, roles: RH_ROLES },
  { path: "/rh/ferias", component: Ferias, roles: RH_ROLES },
  { path: "/rh/ponto", component: PontoEletronico, roles: RH_ROLES },
  { path: "/rh/atestados", component: AtestadosFaltas, roles: RH_ROLES },
  { path: "/rh/avaliacao", component: AvaliacaoDesempenho, roles: RH_ROLES },
  { path: "/rh/onboarding", component: OnboardingOffboarding, roles: RH_ROLES },
  { path: "/rh/dashboard", component: DashboardRH, roles: RH_ROLES },
];
