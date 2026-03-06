import { lazy } from "react";
import { RouteConfig } from "./helpers";

const CockpitGestor = lazy(() => import("@/pages/operacional/CockpitGestor"));
const CentralIndicadores = lazy(() => import("@/pages/operacional/CentralIndicadores"));
const MapaOperacional = lazy(() => import("@/pages/operacional/MapaOperacional"));
const AlertasInteligentes = lazy(() => import("@/pages/operacional/AlertasInteligentes"));
const AnaliseConcorrencia = lazy(() => import("@/pages/operacional/AnaliseConcorrencia"));
const ConselhosIA = lazy(() => import("@/pages/operacional/ConselhosIA"));
const DashboardExecutivo = lazy(() => import("@/pages/operacional/DashboardExecutivo"));
const DashboardAvancado = lazy(() => import("@/pages/operacional/DashboardAvancado"));
const DashboardTrabalhista = lazy(() => import("@/pages/operacional/DashboardTrabalhista"));
const DashboardLogistico = lazy(() => import("@/pages/operacional/DashboardLogistico"));
const DRE = lazy(() => import("@/pages/operacional/DRE"));
const MetasDesafios = lazy(() => import("@/pages/operacional/MetasDesafios"));
const MapaEntregadores = lazy(() => import("@/pages/operacional/MapaEntregadores"));
const PlanejamentoAnual = lazy(() => import("@/pages/operacional/PlanejamentoAnual"));
const PlanejamentoMensal = lazy(() => import("@/pages/operacional/PlanejamentoMensal"));
const Planejamento = lazy(() => import("@/pages/operacional/Planejamento"));
const AnaliseResultados = lazy(() => import("@/pages/operacional/AnaliseResultados"));
const CanaisVenda = lazy(() => import("@/pages/operacional/CanaisVenda"));
const PontoEquilibrio = lazy(() => import("@/pages/operacional/PontoEquilibrio"));
const ResultadoOperacional = lazy(() => import("@/pages/operacional/ResultadoOperacional"));
const WorkflowAprovacoes = lazy(() => import("@/pages/operacional/WorkflowAprovacoes"));
const SlaEntregas = lazy(() => import("@/pages/operacional/SlaEntregas"));
const GestaoRotas = lazy(() => import("@/pages/operacional/GestaoRotas"));
const GestaoEscalas = lazy(() => import("@/pages/rh/Horarios"));
const GamificacaoEntregadores = lazy(() => import("@/pages/operacional/GamificacaoEntregadores"));
const Licitacoes = lazy(() => import("@/pages/operacional/Licitacoes"));
const RelatorioGerencial = lazy(() => import("@/pages/operacional/RelatorioGerencial"));
const CategoriasDespesa = lazy(() => import("@/pages/config/CategoriasDespesa"));

export const operacionalRoutes: RouteConfig[] = [
  { path: "/operacional/cockpit", component: CockpitGestor, roles: ["admin", "gestor"] },
  { path: "/operacional/indicadores", component: CentralIndicadores, roles: ["admin", "gestor"] },
  { path: "/operacional/centro", component: MapaOperacional, roles: ["admin", "gestor", "operacional"] },
  { path: "/operacional/alertas", component: AlertasInteligentes, roles: ["admin", "gestor"] },
  { path: "/operacional/concorrencia", component: AnaliseConcorrencia, roles: ["admin", "gestor"] },
  { path: "/operacional/ia", component: ConselhosIA, roles: ["admin", "gestor"] },
  { path: "/operacional/executivo", component: DashboardExecutivo, roles: ["admin", "gestor"] },
  { path: "/operacional/avancado", component: DashboardAvancado, roles: ["admin", "gestor"] },
  { path: "/operacional/trabalhista", component: DashboardTrabalhista, roles: ["admin", "gestor"] },
  { path: "/operacional/logistico", component: DashboardLogistico, roles: ["admin", "gestor", "operacional"] },
  { path: "/operacional/dre", component: DRE, roles: ["admin", "gestor", "financeiro"] },
  { path: "/operacional/metas", component: MetasDesafios, roles: ["admin", "gestor"] },
  { path: "/operacional/mapa", component: MapaEntregadores, roles: ["admin", "gestor", "operacional"] },
  { path: "/operacional/anual", component: PlanejamentoAnual, roles: ["admin", "gestor"] },
  { path: "/operacional/mensal", component: PlanejamentoMensal, roles: ["admin", "gestor"] },
  { path: "/operacional/planejamento", component: Planejamento, roles: ["admin", "gestor"] },
  { path: "/operacional/analise-resultados", component: AnaliseResultados, roles: ["admin", "gestor", "financeiro"] },
  { path: "/operacional/canais-venda", component: CanaisVenda, roles: ["admin", "gestor", "operacional"] },
  { path: "/config/canais-venda", component: CanaisVenda, roles: ["admin", "gestor", "operacional"] },
  { path: "/operacional/aprovacoes", component: WorkflowAprovacoes, roles: ["admin", "gestor"] },
  { path: "/operacional/sla", component: SlaEntregas, roles: ["admin", "gestor", "operacional"] },
  { path: "/operacional/rotas", component: GestaoRotas, roles: ["admin", "gestor"] },
  { path: "/operacional/escalas", component: GestaoEscalas, roles: ["admin", "gestor"] },
  { path: "/operacional/ponto-equilibrio", component: PontoEquilibrio, roles: ["admin", "gestor"] },
  { path: "/operacional/resultado", component: ResultadoOperacional, roles: ["admin", "gestor"] },
  { path: "/operacional/gamificacao-entregadores", component: GamificacaoEntregadores, roles: ["admin", "gestor"] },
  { path: "/operacional/licitacoes", component: Licitacoes, roles: ["admin", "gestor", "financeiro"] },
  { path: "/operacional/gerencial", component: RelatorioGerencial, roles: ["admin", "gestor"] },
  { path: "/config/categorias-despesa", component: CategoriasDespesa, roles: ["admin", "gestor"] },
];
