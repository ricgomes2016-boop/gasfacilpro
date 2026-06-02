import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Flag,
  Lightbulb,
  Plus,
  Rocket,
  Store,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/layout/Header";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  createStrategicActionPlan,
  createStrategicProject,
  createStrategicSwot,
  createStrategicTarget,
  fetchStrategicPlanningData,
  StrategicActionPlan,
  StrategicPlanningData,
  StrategicProject,
  StrategicSwot,
  StrategicTarget,
} from "@/services/strategicPlanningService";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const today = new Date().toISOString().slice(0, 10);
const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

const emptyData: StrategicPlanningData = {
  overview: {
    realizedRevenue: 0,
    realizedOrders: 0,
    realizedProfit: 0,
    averageTicket: 0,
    activeTargets: 0,
    targetRevenue: 0,
    targetOrders: 0,
    targetProgress: 0,
    openProjects: 0,
    openActions: 0,
    overdueActions: 0,
    strategicAlerts: [],
    recommendations: [],
  },
  targets: [],
  projects: [],
  swot: [],
  actions: [],
};

function statusTone(status: string) {
  if (["concluida"].includes(status)) return "bg-success/10 text-success border-success/25";
  if (["atrasada", "critica"].includes(status)) return "bg-destructive/10 text-destructive border-destructive/25";
  if (["pausada", "pendente"].includes(status)) return "bg-warning/15 text-warning border-warning/30";
  return "bg-primary/10 text-primary border-primary/25";
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Target;
  tone?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const toneClass = {
    primary: "status-card-icon-primary",
    success: "status-card-icon-success",
    warning: "status-card-icon-warning",
    destructive: "status-card-icon-destructive",
    info: "status-card-icon-info",
  }[tone];

  return (
    <Card className={`kpi-card kpi-card-${tone === "destructive" ? "destructive" : tone}`}>
      <CardContent className="kpi-card-content">
        <div className={`status-card-icon ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="kpi-value">{value}</p>
          <p className="kpi-label text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-6 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function Planejamento() {
  const { empresa } = useEmpresa();
  const { unidadeAtual, unidades } = useUnidade();
  const [data, setData] = useState<StrategicPlanningData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [targetForm, setTargetForm] = useState({
    unidade_id: "rede",
    product_scope: "Todos",
    period_type: "mensal",
    period_start: today,
    period_end: monthEnd,
    quantity_goal: "0",
    revenue_goal: "0",
    profit_goal: "0",
    desired_ticket: "0",
  });

  const [projectForm, setProjectForm] = useState({
    unidade_id: "rede",
    name: "",
    investment_estimated: "0",
    expected_return: "0",
    payback_months: "0",
    revenue_impact: "0",
    profit_impact: "0",
    risk_score: "2",
    urgency_score: "3",
  });

  const [swotForm, setSwotForm] = useState({
    unidade_id: "rede",
    quadrant: "oportunidade",
    description: "",
    impact: "medio",
    recommended_action: "",
    owner_name: "",
    due_date: monthEnd,
  });

  const [actionForm, setActionForm] = useState({
    unidade_id: "rede",
    title: "",
    what: "",
    why: "",
    who: "",
    when_date: monthEnd,
    where_place: "",
    how: "",
    cost: "0",
    priority: "media",
  });

  const currentScope = useMemo(() => unidadeAtual?.id || null, [unidadeAtual?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchStrategicPlanningData({
        empresaId: empresa?.id,
        unidadeId: currentScope,
      });
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel carregar o planejamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresa?.id) void loadData();
  }, [empresa?.id, currentScope]);

  const normalizeUnit = (value: string) => (value === "rede" ? null : value);

  const unidadeNome = (unidadeId: string | null) => unidades.find((u) => u.id === unidadeId)?.nome || "Rede inteira";

  const handleCreateTarget = async () => {
    if (!empresa?.id) return;
    setSaving(true);
    const { error } = await createStrategicTarget({
      empresa_id: empresa.id,
      unidade_id: normalizeUnit(targetForm.unidade_id),
      product_scope: targetForm.product_scope,
      period_type: targetForm.period_type,
      period_start: targetForm.period_start,
      period_end: targetForm.period_end,
      quantity_goal: Number(targetForm.quantity_goal || 0),
      revenue_goal: Number(targetForm.revenue_goal || 0),
      profit_goal: Number(targetForm.profit_goal || 0),
      desired_ticket: Number(targetForm.desired_ticket || 0),
      status: "ativa",
    });
    setSaving(false);
    if (error) {
      toast.error("Nao foi possivel salvar a meta. Verifique se a migration foi aplicada.");
      return;
    }
    toast.success("Meta estrategica criada.");
    setTargetForm((prev) => ({ ...prev, quantity_goal: "0", revenue_goal: "0", profit_goal: "0" }));
    await loadData();
  };

  const handleCreateProject = async () => {
    if (!empresa?.id || !projectForm.name.trim()) return;
    setSaving(true);
    const { error } = await createStrategicProject({
      empresa_id: empresa.id,
      unidade_id: normalizeUnit(projectForm.unidade_id),
      name: projectForm.name.trim(),
      investment_estimated: Number(projectForm.investment_estimated || 0),
      expected_return: Number(projectForm.expected_return || 0),
      payback_months: Number(projectForm.payback_months || 0),
      revenue_impact: Number(projectForm.revenue_impact || 0),
      profit_impact: Number(projectForm.profit_impact || 0),
      risk_score: Number(projectForm.risk_score || 0),
      urgency_score: Number(projectForm.urgency_score || 0),
      status: "em_andamento",
    });
    setSaving(false);
    if (error) {
      toast.error("Nao foi possivel salvar o projeto. Verifique se a migration foi aplicada.");
      return;
    }
    toast.success("Projeto cadastrado.");
    setProjectForm((prev) => ({ ...prev, name: "" }));
    await loadData();
  };

  const handleCreateSwot = async () => {
    if (!empresa?.id || !swotForm.description.trim()) return;
    setSaving(true);
    const { error } = await createStrategicSwot({
      empresa_id: empresa.id,
      unidade_id: normalizeUnit(swotForm.unidade_id),
      quadrant: swotForm.quadrant as StrategicSwot["quadrant"],
      description: swotForm.description.trim(),
      impact: swotForm.impact as StrategicSwot["impact"],
      recommended_action: swotForm.recommended_action || null,
      owner_name: swotForm.owner_name || null,
      due_date: swotForm.due_date || null,
      status: "pendente",
    });
    setSaving(false);
    if (error) {
      toast.error("Nao foi possivel salvar a analise SWOT. Verifique se a migration foi aplicada.");
      return;
    }
    toast.success("Item SWOT cadastrado.");
    setSwotForm((prev) => ({ ...prev, description: "", recommended_action: "" }));
    await loadData();
  };

  const handleCreateAction = async () => {
    if (!empresa?.id || !actionForm.title.trim() || !actionForm.what.trim()) return;
    setSaving(true);
    const { error } = await createStrategicActionPlan({
      empresa_id: empresa.id,
      unidade_id: normalizeUnit(actionForm.unidade_id),
      title: actionForm.title.trim(),
      what: actionForm.what.trim(),
      why: actionForm.why || null,
      who: actionForm.who || null,
      when_date: actionForm.when_date || null,
      where_place: actionForm.where_place || null,
      how: actionForm.how || null,
      cost: Number(actionForm.cost || 0),
      priority: actionForm.priority as StrategicActionPlan["priority"],
      status: "pendente",
    });
    setSaving(false);
    if (error) {
      toast.error("Nao foi possivel salvar o plano. Verifique se a migration foi aplicada.");
      return;
    }
    toast.success("Plano de acao cadastrado.");
    setActionForm((prev) => ({ ...prev, title: "", what: "", why: "", how: "" }));
    await loadData();
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Planejamento Estrategico" subtitle="Plano de acao, metas e decisoes da revenda" />
        <PageSectionLoader label="Carregando planejamento estrategico..." />
      </MainLayout>
    );
  }

  const { overview } = data;

  return (
    <MainLayout>
      <Header
        title="Planejamento Estrategico"
        subtitle="Metas, projetos, SWOT e 5W2H para executar a estrategia da revenda"
      />

      <div className="dashboard-shell">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-success/10">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-primary/25 bg-primary/10 text-primary">Plano executivo</Badge>
                  <Badge variant="outline">{unidadeAtual?.nome || "Rede inteira"}</Badge>
                </div>
                <h2 className="mt-3 text-xl font-bold leading-tight text-foreground sm:text-2xl">
                  Decidir, executar e acompanhar sem repetir dashboard
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Use esta tela para transformar indicadores em compromissos: metas, projetos, riscos e planos 5W2H com dono,
                  prazo e prioridade.
                </p>
              </div>
              <div className="min-w-[220px] rounded-2xl border border-border/45 bg-card/85 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progresso da meta ativa</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{overview.targetProgress.toFixed(0)}%</p>
                <Progress value={overview.targetProgress} className="mt-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Receita realizada" value={brl(overview.realizedRevenue)} description="Mes atual" icon={TrendingUp} tone="success" />
          <MetricCard title="Meta ativa" value={brl(overview.targetRevenue)} description={`${overview.activeTargets} meta(s)`} icon={Target} />
          <MetricCard title="Pedidos" value={`${overview.realizedOrders}`} description={`Meta ${overview.targetOrders || 0}`} icon={ClipboardList} tone="info" />
          <MetricCard title="Projetos" value={`${overview.openProjects}`} description="Em andamento" icon={Rocket} tone="warning" />
          <MetricCard title="Acoes abertas" value={`${overview.openActions}`} description={`${overview.overdueActions} vencida(s)`} icon={CalendarCheck} tone={overview.overdueActions > 0 ? "destructive" : "primary"} />
        </div>

        <Tabs defaultValue="visao" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3 xl:inline-grid xl:w-auto xl:grid-cols-6">
            <TabsTrigger value="visao" className="gap-2"><Brain className="h-4 w-4" />Visao</TabsTrigger>
            <TabsTrigger value="metas" className="gap-2"><Target className="h-4 w-4" />Metas</TabsTrigger>
            <TabsTrigger value="projetos" className="gap-2"><Rocket className="h-4 w-4" />Projetos</TabsTrigger>
            <TabsTrigger value="swot" className="gap-2"><BarChart3 className="h-4 w-4" />SWOT</TabsTrigger>
            <TabsTrigger value="acoes" className="gap-2"><CheckCircle2 className="h-4 w-4" />5W2H</TabsTrigger>
            <TabsTrigger value="sugestoes" className="gap-2"><Lightbulb className="h-4 w-4" />Sugestoes</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Leitura estrategica do mes</CardTitle>
                  <CardDescription>Resumo calculado com pedidos, caixa e metas cadastradas.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/45 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Lucro operacional estimado</p>
                    <p className="mt-1 text-2xl font-bold">{brl(overview.realizedProfit)}</p>
                  </div>
                  <div className="rounded-xl border border-border/45 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Ticket medio</p>
                    <p className="mt-1 text-2xl font-bold">{brl(overview.averageTicket)}</p>
                  </div>
                  <div className="rounded-xl border border-border/45 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Planos em aberto</p>
                    <p className="mt-1 text-2xl font-bold">{overview.openActions}</p>
                  </div>
                  <div className="rounded-xl border border-border/45 bg-muted/25 p-4">
                    <p className="text-sm text-muted-foreground">Projetos em andamento</p>
                    <p className="mt-1 text-2xl font-bold">{overview.openProjects}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alertas estrategicos</CardTitle>
                  <CardDescription>Alertas para virar plano, nao apenas visualizacao.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.strategicAlerts.length === 0 ? (
                    <EmptyState title="Sem alerta critico" description="Cadastre metas e planos para enriquecer a leitura." />
                  ) : (
                    overview.strategicAlerts.map((alert) => (
                      <div key={alert} className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <p className="text-sm font-medium">{alert}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="metas" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Nova meta por loja</CardTitle>
                <CardDescription>Cadastre metas de venda, receita e lucro por produto ou para a rede.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={targetForm.unidade_id} onValueChange={(value) => setTargetForm((p) => ({ ...p, unidade_id: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rede">Rede inteira</SelectItem>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={targetForm.product_scope} onChange={(e) => setTargetForm((p) => ({ ...p, product_scope: e.target.value }))} placeholder="Produto: P13, P20, Agua..." />
                <Input type="number" value={targetForm.quantity_goal} onChange={(e) => setTargetForm((p) => ({ ...p, quantity_goal: e.target.value }))} placeholder="Quantidade meta" />
                <Input type="number" value={targetForm.revenue_goal} onChange={(e) => setTargetForm((p) => ({ ...p, revenue_goal: e.target.value }))} placeholder="Faturamento meta" />
                <Input type="number" value={targetForm.profit_goal} onChange={(e) => setTargetForm((p) => ({ ...p, profit_goal: e.target.value }))} placeholder="Lucro meta" />
                <Input type="number" value={targetForm.desired_ticket} onChange={(e) => setTargetForm((p) => ({ ...p, desired_ticket: e.target.value }))} placeholder="Ticket desejado" />
                <Input type="date" value={targetForm.period_start} onChange={(e) => setTargetForm((p) => ({ ...p, period_start: e.target.value }))} />
                <Input type="date" value={targetForm.period_end} onChange={(e) => setTargetForm((p) => ({ ...p, period_end: e.target.value }))} />
                <Button onClick={handleCreateTarget} disabled={saving} className="md:col-span-4">
                  <Flag className="mr-2 h-4 w-4" />Salvar meta
                </Button>
              </CardContent>
            </Card>
            <TargetsTable targets={data.targets} unidadeNome={unidadeNome} />
          </TabsContent>

          <TabsContent value="projetos" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Projetos e investimentos</CardTitle>
                <CardDescription>Priorize compras, contratacoes, rotas e expansao com nota automatica.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={projectForm.unidade_id} onValueChange={(value) => setProjectForm((p) => ({ ...p, unidade_id: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rede">Rede inteira</SelectItem>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="md:col-span-3" value={projectForm.name} onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex.: comprar moto, abrir loja, campanha WhatsApp" />
                <Input type="number" value={projectForm.investment_estimated} onChange={(e) => setProjectForm((p) => ({ ...p, investment_estimated: e.target.value }))} placeholder="Investimento" />
                <Input type="number" value={projectForm.expected_return} onChange={(e) => setProjectForm((p) => ({ ...p, expected_return: e.target.value }))} placeholder="Retorno previsto" />
                <Input type="number" value={projectForm.revenue_impact} onChange={(e) => setProjectForm((p) => ({ ...p, revenue_impact: e.target.value }))} placeholder="Impacto receita" />
                <Input type="number" value={projectForm.profit_impact} onChange={(e) => setProjectForm((p) => ({ ...p, profit_impact: e.target.value }))} placeholder="Impacto lucro" />
                <Label className="space-y-2">
                  <span>Risco 1-5</span>
                  <Input type="number" min="1" max="5" value={projectForm.risk_score} onChange={(e) => setProjectForm((p) => ({ ...p, risk_score: e.target.value }))} />
                </Label>
                <Label className="space-y-2">
                  <span>Urgencia 1-5</span>
                  <Input type="number" min="1" max="5" value={projectForm.urgency_score} onChange={(e) => setProjectForm((p) => ({ ...p, urgency_score: e.target.value }))} />
                </Label>
                <Input type="number" value={projectForm.payback_months} onChange={(e) => setProjectForm((p) => ({ ...p, payback_months: e.target.value }))} placeholder="Payback meses" />
                <Button onClick={handleCreateProject} disabled={saving} className="md:col-span-4">
                  <Rocket className="mr-2 h-4 w-4" />Salvar projeto
                </Button>
              </CardContent>
            </Card>
            <ProjectsTable projects={data.projects} unidadeNome={unidadeNome} />
          </TabsContent>

          <TabsContent value="swot" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Analise SWOT</CardTitle>
                <CardDescription>Registre riscos e oportunidades com acao recomendada, dono e prazo.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={swotForm.unidade_id} onValueChange={(value) => setSwotForm((p) => ({ ...p, unidade_id: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rede">Rede inteira</SelectItem>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={swotForm.quadrant} onValueChange={(value) => setSwotForm((p) => ({ ...p, quadrant: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forca">Forca</SelectItem>
                    <SelectItem value="fraqueza">Fraqueza</SelectItem>
                    <SelectItem value="oportunidade">Oportunidade</SelectItem>
                    <SelectItem value="ameaca">Ameaca</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={swotForm.impact} onValueChange={(value) => setSwotForm((p) => ({ ...p, impact: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={swotForm.due_date} onChange={(e) => setSwotForm((p) => ({ ...p, due_date: e.target.value }))} />
                <Textarea className="md:col-span-2" value={swotForm.description} onChange={(e) => setSwotForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descricao" />
                <Textarea className="md:col-span-2" value={swotForm.recommended_action} onChange={(e) => setSwotForm((p) => ({ ...p, recommended_action: e.target.value }))} placeholder="Acao recomendada" />
                <Input className="md:col-span-4" value={swotForm.owner_name} onChange={(e) => setSwotForm((p) => ({ ...p, owner_name: e.target.value }))} placeholder="Responsavel" />
                <Button onClick={handleCreateSwot} disabled={saving} className="md:col-span-4">
                  <BarChart3 className="mr-2 h-4 w-4" />Salvar SWOT
                </Button>
              </CardContent>
            </Card>
            <SwotGrid swot={data.swot} unidadeNome={unidadeNome} />
          </TabsContent>

          <TabsContent value="acoes" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Plano de acao 5W2H</CardTitle>
                <CardDescription>O planejamento vira compromisso com dono, prazo, custo e prioridade.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={actionForm.unidade_id} onValueChange={(value) => setActionForm((p) => ({ ...p, unidade_id: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rede">Rede inteira</SelectItem>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="md:col-span-3" value={actionForm.title} onChange={(e) => setActionForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titulo do plano" />
                <Textarea className="md:col-span-2" value={actionForm.what} onChange={(e) => setActionForm((p) => ({ ...p, what: e.target.value }))} placeholder="O que sera feito?" />
                <Textarea className="md:col-span-2" value={actionForm.why} onChange={(e) => setActionForm((p) => ({ ...p, why: e.target.value }))} placeholder="Por que?" />
                <Input value={actionForm.who} onChange={(e) => setActionForm((p) => ({ ...p, who: e.target.value }))} placeholder="Quem?" />
                <Input type="date" value={actionForm.when_date} onChange={(e) => setActionForm((p) => ({ ...p, when_date: e.target.value }))} />
                <Input value={actionForm.where_place} onChange={(e) => setActionForm((p) => ({ ...p, where_place: e.target.value }))} placeholder="Onde?" />
                <Input type="number" value={actionForm.cost} onChange={(e) => setActionForm((p) => ({ ...p, cost: e.target.value }))} placeholder="Quanto custa?" />
                <Textarea className="md:col-span-3" value={actionForm.how} onChange={(e) => setActionForm((p) => ({ ...p, how: e.target.value }))} placeholder="Como sera executado?" />
                <Select value={actionForm.priority} onValueChange={(value) => setActionForm((p) => ({ ...p, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Critica</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreateAction} disabled={saving} className="md:col-span-4">
                  <CheckCircle2 className="mr-2 h-4 w-4" />Salvar plano
                </Button>
              </CardContent>
            </Card>
            <ActionsTable actions={data.actions} unidadeNome={unidadeNome} />
          </TabsContent>

          <TabsContent value="sugestoes" className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {overview.recommendations.map((recommendation) => (
                <Card key={recommendation} className="border-success/25">
                  <CardContent className="flex gap-3 p-4">
                    <div className="status-card-icon status-card-icon-success">
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Sugestao inteligente</p>
                      <p className="mt-1 text-sm text-muted-foreground">{recommendation}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function TargetsTable({ targets, unidadeNome }: { targets: StrategicTarget[]; unidadeNome: (id: string | null) => string }) {
  if (targets.length === 0) return <EmptyState title="Nenhuma meta cadastrada" description="Crie metas para a rede ou por loja." />;
  return (
    <Card>
      <CardHeader><CardTitle>Metas cadastradas</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loja</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((target) => (
              <TableRow key={target.id}>
                <TableCell className="font-medium">{unidadeNome(target.unidade_id)}</TableCell>
                <TableCell>{target.product_scope}</TableCell>
                <TableCell>{target.period_start} ate {target.period_end}</TableCell>
                <TableCell className="text-right">{target.quantity_goal}</TableCell>
                <TableCell className="text-right">{brl(target.revenue_goal)}</TableCell>
                <TableCell><Badge variant="outline" className={statusTone(target.status)}>{target.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProjectsTable({ projects, unidadeNome }: { projects: StrategicProject[]; unidadeNome: (id: string | null) => string }) {
  if (projects.length === 0) return <EmptyState title="Nenhum projeto cadastrado" description="Cadastre investimentos e iniciativas para priorizar." />;
  return (
    <Card>
      <CardHeader><CardTitle>Matriz de decisao</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead className="text-right">Investimento</TableHead>
              <TableHead className="text-right">Retorno</TableHead>
              <TableHead className="text-right">Nota</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>{unidadeNome(project.unidade_id)}</TableCell>
                <TableCell className="text-right">{brl(project.investment_estimated)}</TableCell>
                <TableCell className="text-right">{brl(project.expected_return)}</TableCell>
                <TableCell className="text-right font-bold">{project.priority_score}</TableCell>
                <TableCell><Badge variant="outline" className={statusTone(project.status)}>{project.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SwotGrid({ swot, unidadeNome }: { swot: StrategicSwot[]; unidadeNome: (id: string | null) => string }) {
  const quadrants = [
    ["forca", "Forcas"],
    ["fraqueza", "Fraquezas"],
    ["oportunidade", "Oportunidades"],
    ["ameaca", "Ameacas"],
  ];
  if (swot.length === 0) return <EmptyState title="SWOT vazio" description="Cadastre forcas, fraquezas, oportunidades e ameacas." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {quadrants.map(([key, label]) => (
        <Card key={key}>
          <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {swot.filter((item) => item.quadrant === key).map((item) => (
              <div key={item.id} className="rounded-xl border border-border/45 bg-muted/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{unidadeNome(item.unidade_id)}</Badge>
                  <Badge variant="outline" className={item.impact === "alto" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-primary/25 bg-primary/10 text-primary"}>{item.impact}</Badge>
                </div>
                <p className="mt-2 font-medium">{item.description}</p>
                {item.recommended_action && <p className="mt-1 text-sm text-muted-foreground">{item.recommended_action}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ActionsTable({ actions, unidadeNome }: { actions: StrategicActionPlan[]; unidadeNome: (id: string | null) => string }) {
  if (actions.length === 0) return <EmptyState title="Nenhum plano 5W2H" description="Crie planos com dono, prazo e prioridade." />;
  return (
    <Card>
      <CardHeader><CardTitle>Planos de acao</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Acao</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Responsavel</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => (
              <TableRow key={action.id}>
                <TableCell>
                  <p className="font-medium">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.what}</p>
                </TableCell>
                <TableCell>{unidadeNome(action.unidade_id)}</TableCell>
                <TableCell>{action.who || "-"}</TableCell>
                <TableCell>{action.when_date || "-"}</TableCell>
                <TableCell><Badge variant="outline" className={statusTone(action.priority)}>{action.priority}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={statusTone(action.status)}>{action.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
