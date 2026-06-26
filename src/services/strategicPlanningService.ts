import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type StrategicStatus = "ativa" | "pausada" | "concluida" | "em_andamento" | "pendente" | "atrasada";
export type StrategicPriority = "baixa" | "media" | "alta" | "critica";

export interface StrategicTarget {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  product_scope: string;
  period_type: string;
  period_start: string;
  period_end: string;
  quantity_goal: number;
  revenue_goal: number;
  profit_goal: number;
  desired_ticket: number;
  status: StrategicStatus;
  created_at: string;
}

export interface StrategicProject {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  name: string;
  investment_estimated: number;
  expected_return: number;
  payback_months: number;
  revenue_impact: number;
  profit_impact: number;
  risk_score: number;
  urgency_score: number;
  priority_score: number;
  status: StrategicStatus;
  created_at: string;
}

export interface StrategicSwot {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  quadrant: "forca" | "fraqueza" | "oportunidade" | "ameaca";
  description: string;
  impact: "baixo" | "medio" | "alto";
  recommended_action: string | null;
  owner_name: string | null;
  due_date: string | null;
  status: StrategicStatus;
  created_at: string;
}

export interface StrategicActionPlan {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  title: string;
  what: string;
  why: string | null;
  who: string | null;
  when_date: string | null;
  where_place: string | null;
  how: string | null;
  cost: number;
  priority: StrategicPriority;
  status: StrategicStatus;
  linked_type: string | null;
  linked_id: string | null;
  created_at: string;
}

export interface StrategicOverview {
  realizedRevenue: number;
  realizedOrders: number;
  realizedProfit: number;
  averageTicket: number;
  activeTargets: number;
  targetRevenue: number;
  targetOrders: number;
  targetProgress: number;
  openProjects: number;
  openActions: number;
  overdueActions: number;
  strategicAlerts: string[];
  recommendations: string[];
}

export interface StrategicPlanningData {
  overview: StrategicOverview;
  targets: StrategicTarget[];
  projects: StrategicProject[];
  swot: StrategicSwot[];
  actions: StrategicActionPlan[];
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const safeNumber = (value: unknown) => Number(value || 0);

const monthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
};

async function safeSelect<T>(table: string, queryBuilder: (tableName: string) => any): Promise<T[]> {
  try {
    const { data, error } = await queryBuilder(table);
    if (error) {
      if (error.code !== "42P01") console.error(`Erro ao carregar ${table}:`, error);
      return [];
    }
    return (data || []) as T[];
  } catch (error) {
    console.error(`Erro ao carregar ${table}:`, error);
    return [];
  }
}

export async function fetchStrategicPlanningData(params: {
  empresaId?: string | null;
  unidadeId?: string | null;
}): Promise<StrategicPlanningData> {
  const { empresaId, unidadeId } = params;
  const { start, end } = monthRange();

  let pedidosQuery = db
    .from("pedidos")
    .select("valor_total,status,created_at,unidade_id")
    .gte("created_at", start)
    .lt("created_at", end)
    .neq("status", "cancelado");

  if (empresaId) pedidosQuery = pedidosQuery.eq("empresa_id", empresaId);
  if (unidadeId) pedidosQuery = pedidosQuery.eq("unidade_id", unidadeId);

  const { data: pedidos = [] } = await pedidosQuery;

  let caixaQuery = db
    .from("movimentacoes_caixa")
    .select("valor,tipo,created_at,unidade_id")
    .gte("created_at", start)
    .lt("created_at", end);

  if (empresaId) caixaQuery = caixaQuery.eq("empresa_id", empresaId);
  if (unidadeId) caixaQuery = caixaQuery.eq("unidade_id", unidadeId);

  const { data: caixa = [] } = await caixaQuery;

  const tableFilter = (tableName: string) => {
    let query = db.from(tableName).select("*").order("created_at", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    if (unidadeId) query = query.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);
    return query;
  };

  const [targets, projects, swot, actions] = await Promise.all([
    safeSelect<StrategicTarget>("strategic_targets", tableFilter),
    safeSelect<StrategicProject>("strategic_projects", tableFilter),
    safeSelect<StrategicSwot>("strategic_swot", tableFilter),
    safeSelect<StrategicActionPlan>("strategic_action_plans", tableFilter),
  ]);

  const realizedRevenue = pedidos.reduce((sum: number, pedido: any) => sum + safeNumber(pedido.valor_total), 0);
  const realizedOrders = pedidos.length;
  const caixaEntrada = caixa.filter((item: any) => item.tipo === "entrada").reduce((sum: number, item: any) => sum + safeNumber(item.valor), 0);
  const caixaSaida = caixa.filter((item: any) => item.tipo === "saida").reduce((sum: number, item: any) => sum + safeNumber(item.valor), 0);
  const realizedProfit = caixaEntrada - caixaSaida || realizedRevenue - caixaSaida;
  const averageTicket = realizedOrders > 0 ? realizedRevenue / realizedOrders : 0;

  const activeTargets = targets.filter((target) => target.status === "ativa");
  const targetRevenue = activeTargets.reduce((sum, target) => sum + safeNumber(target.revenue_goal), 0);
  const targetOrders = activeTargets.reduce((sum, target) => sum + safeNumber(target.quantity_goal), 0);
  const targetProgress = targetRevenue > 0 ? Math.min(100, (realizedRevenue / targetRevenue) * 100) : 0;

  const openActions = actions.filter((action) => !["concluida"].includes(action.status));
  const overdueActions = openActions.filter((action) => action.when_date && action.when_date < todayIso()).length;
  const openProjects = projects.filter((project) => !["concluida"].includes(project.status)).length;

  const strategicAlerts: string[] = [];
  if (targetRevenue > 0 && targetProgress < 80) strategicAlerts.push("Receita realizada abaixo de 80% da meta ativa.");
  if (overdueActions > 0) strategicAlerts.push(`${overdueActions} plano(s) de acao com prazo vencido.`);
  if (projects.some((project) => project.risk_score >= 4 && project.status !== "concluida")) {
    strategicAlerts.push("Ha projeto de alto risco em andamento.");
  }
  if (activeTargets.length === 0) strategicAlerts.push("Nenhuma meta estrategica ativa cadastrada para o periodo.");

  const recommendations: string[] = [];
  if (targetRevenue > 0 && targetProgress < 80) {
    recommendations.push("Criar acao comercial para clientes inativos e acompanhar diariamente ate recuperar a meta.");
  }
  if (averageTicket > 0 && averageTicket < 120) {
    recommendations.push("Avaliar oferta combinada gas + agua para elevar o ticket medio.");
  }
  if (overdueActions > 0) {
    recommendations.push("Repriorizar planos vencidos e atribuir responsavel unico por acao critica.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Definir 3 prioridades da semana: venda, margem e atendimento. Acompanhar execucao no 5W2H.");
  }

  return {
    overview: {
      realizedRevenue,
      realizedOrders,
      realizedProfit,
      averageTicket,
      activeTargets: activeTargets.length,
      targetRevenue,
      targetOrders,
      targetProgress,
      openProjects,
      openActions: openActions.length,
      overdueActions,
      strategicAlerts,
      recommendations,
    },
    targets,
    projects,
    swot,
    actions,
  };
}

export async function createStrategicTarget(payload: Partial<StrategicTarget>) {
  return db.from("strategic_targets").insert(payload).select("*").single();
}

export async function createStrategicProject(payload: Partial<StrategicProject>) {
  const investment = safeNumber(payload.investment_estimated);
  const impact = safeNumber(payload.revenue_impact) + safeNumber(payload.profit_impact);
  const risk = safeNumber(payload.risk_score) * 1000;
  const urgency = safeNumber(payload.urgency_score) * 1000;
  const priorityScore = Math.round(impact + urgency - investment * 0.2 - risk);

  return db
    .from("strategic_projects")
    .insert({ ...payload, priority_score: priorityScore })
    .select("*")
    .single();
}

export async function createStrategicSwot(payload: Partial<StrategicSwot>) {
  return db.from("strategic_swot").insert(payload).select("*").single();
}

export async function createStrategicActionPlan(payload: Partial<StrategicActionPlan>) {
  return db.from("strategic_action_plans").insert(payload).select("*").single();
}
