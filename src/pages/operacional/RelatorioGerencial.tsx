import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Brain,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Package,
  Percent,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

type PedidoRow = {
  id: string;
  valor_total: number | string | null;
  status: string | null;
  created_at: string | null;
  forma_pagamento: string | null;
};

type DespesaRow = {
  id: string;
  valor: number | string | null;
  categoria: string | null;
  status: string | null;
  vencimento: string | null;
};

type ProdutoRow = {
  id: string;
  nome: string | null;
  preco: number | string | null;
  preco_custo: number | string | null;
  estoque_atual: number | null;
};

type ClienteRow = {
  id: string;
  nome: string | null;
  created_at: string | null;
};

type PeriodoIA = "semanal" | "mensal";
type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "info" | "destructive";

const chartPalette = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const toneStyles: Record<Tone, { bar: string; icon: string; soft: string; text: string }> = {
  primary: {
    bar: "bg-primary",
    icon: "rounded-lg bg-primary/10 p-2 text-primary",
    soft: "border-primary/30 bg-primary/10 text-foreground",
    text: "text-primary",
  },
  secondary: {
    bar: "bg-secondary",
    icon: "rounded-lg bg-secondary/10 p-2 text-secondary",
    soft: "border-secondary/30 bg-secondary/10 text-foreground",
    text: "text-secondary",
  },
  accent: {
    bar: "bg-accent",
    icon: "rounded-lg bg-accent/10 p-2 text-accent",
    soft: "border-accent/30 bg-accent/10 text-foreground",
    text: "text-accent",
  },
  success: {
    bar: "bg-success",
    icon: "rounded-lg bg-success/10 p-2 text-success",
    soft: "border-success/30 bg-success/10 text-foreground",
    text: "text-success",
  },
  warning: {
    bar: "bg-warning",
    icon: "rounded-lg bg-warning/15 p-2 text-warning",
    soft: "border-warning/40 bg-warning/15 text-foreground",
    text: "text-warning",
  },
  info: {
    bar: "bg-info",
    icon: "rounded-lg bg-info/10 p-2 text-info",
    soft: "border-info/30 bg-info/10 text-foreground",
    text: "text-info",
  },
  destructive: {
    bar: "bg-destructive",
    icon: "rounded-lg bg-destructive/10 p-2 text-destructive",
    soft: "border-destructive/30 bg-destructive/10 text-foreground",
    text: "text-destructive",
  },
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

function asNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatMoneyCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${value < 0 ? "-" : ""}R$ ${(abs / 1000).toFixed(1)}k`;
  return formatMoney(value);
}

function formatTooltipMoney(value: number | string) {
  return formatMoney(Number(value || 0));
}

function chartValueFormatter(value: number | string) {
  return numberFormatter.format(Number(value || 0));
}

function EmptyChart({ label }: { label: string }) {
  return (
    <EmptyState
      className="h-[260px]"
      icon={FileText}
      title="Sem dados suficientes"
      description={label}
    />
  );
}

export default function RelatorioGerencial() {
  const { unidadeAtual } = useUnidade();
  const [vendas, setVendas] = useState<PedidoRow[]>([]);
  const [despesas, setDespesas] = useState<DespesaRow[]>([]);
  const [produtos, setProdutos] = useState<ProdutoRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatorioIA, setRelatorioIA] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);
  const [periodoIA, setPeriodoIA] = useState<PeriodoIA>("mensal");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const inicio = format(startOfMonth(getBrasiliaDate()), "yyyy-MM-dd");
      const fim = format(endOfMonth(getBrasiliaDate()), "yyyy-MM-dd");

      let pedQ = supabase
        .from("pedidos")
        .select("id, valor_total, status, created_at, forma_pagamento")
        .gte("created_at", inicio)
        .lte("created_at", `${fim}T23:59:59`);
      if (unidadeAtual?.id) pedQ = pedQ.eq("unidade_id", unidadeAtual.id);

      let despQ = supabase
        .from("contas_pagar")
        .select("id, valor, categoria, status, vencimento")
        .gte("vencimento", inicio)
        .lte("vencimento", fim);
      if (unidadeAtual?.id) despQ = despQ.eq("unidade_id", unidadeAtual.id);

      let prodQ = supabase.from("produtos").select("id, nome, preco_venda, preco_custo, estoque_atual");
      if (unidadeAtual?.id) prodQ = prodQ.eq("unidade_id", unidadeAtual.id);

      const cliQ = supabase.from("clientes").select("id, nome, created_at");

      const [vendasRes, despesasRes, produtosRes, clientesRes] = await Promise.all([
        pedQ,
        despQ,
        prodQ,
        cliQ,
      ]);

      setVendas((vendasRes.data || []) as PedidoRow[]);
      setDespesas((despesasRes.data || []) as DespesaRow[]);
      setProdutos((produtosRes.data || []) as unknown as ProdutoRow[]);
      setClientes((clientesRes.data || []) as ClienteRow[]);
      setLoading(false);
    };

    fetchAll();
  }, [unidadeAtual?.id]);

  const gerarRelatorioIA = async () => {
    setGerandoIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("relatorio-gerencial-ia", {
        body: { unidade_id: unidadeAtual?.id || null, periodo: periodoIA },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      setRelatorioIA(data?.relatorio || "");
      toast({ title: "Relatório gerado com sucesso!" });
    } catch {
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
    } finally {
      setGerandoIA(false);
    }
  };

  const exportarPDF = () => {
    if (!relatorioIA) return;
    const doc = new jsPDF();
    const titulo = `Relatório Gerencial - ${periodoIA === "semanal" ? "Semanal" : "Mensal"}`;
    doc.setFontSize(16);
    doc.text(titulo, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);

    const lines = doc.splitTextToSize(relatorioIA.replace(/[#*`]/g, "").replace(/\n{2,}/g, "\n\n"), 180);
    doc.setFontSize(9);
    let y = 38;
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 5;
    }
    doc.save(`relatorio-gerencial-${periodoIA}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const metricas = useMemo(() => {
    const vendasConcluidas = vendas.filter((v) => v.status === "entregue" || v.status === "concluido");
    const faturamento = vendasConcluidas.reduce((s, v) => s + asNumber(v.valor_total), 0);
    const totalDespesas = despesas.reduce((s, d) => s + asNumber(d.valor), 0);
    const lucroOperacional = faturamento - totalDespesas;
    const margemOperacional = faturamento > 0 ? (lucroOperacional / faturamento) * 100 : 0;
    const ticketMedio = vendasConcluidas.length > 0 ? faturamento / vendasConcluidas.length : 0;
    const totalPedidos = vendas.length;
    const custoMedioEntrega = vendasConcluidas.length > 0 ? (totalDespesas * 0.3) / vendasConcluidas.length : 0;

    return {
      custoMedioEntrega,
      faturamento,
      lucroOperacional,
      margemOperacional,
      ticketMedio,
      totalDespesas,
      totalPedidos,
      vendasConcluidas,
    };
  }, [despesas, vendas]);

  const vendasPorDia = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const dia = subDays(new Date(), 29 - i);
        const diaStr = format(dia, "yyyy-MM-dd");
        const total = vendas
          .filter((v) => v.created_at?.startsWith(diaStr))
          .reduce((s, v) => s + asNumber(v.valor_total), 0);
        return { dia: format(dia, "dd/MM"), total };
      }),
    [vendas],
  );

  const despesasChart = useMemo(() => {
    const despesasPorCategoria = despesas.reduce((acc: Record<string, number>, d) => {
      const cat = d.categoria || "Outros";
      acc[cat] = (acc[cat] || 0) + asNumber(d.valor);
      return acc;
    }, {});

    return Object.entries(despesasPorCategoria)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [despesas]);

  const pagamentoChart = useMemo(() => {
    const formaPagamento = vendas.reduce((acc: Record<string, number>, v) => {
      const fp = v.forma_pagamento || "Não informado";
      acc[fp] = (acc[fp] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(formaPagamento)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [vendas]);

  const topProdutos = useMemo(
    () =>
      produtos
        .filter((p) => p.preco_venda && p.preco_custo)
        .map((p) => ({
          nome: p.nome || "Produto",
          margem: ((asNumber(p.preco_venda) - asNumber(p.preco_custo)) / asNumber(p.preco_venda)) * 100,
          estoque: p.estoque_atual || 0,
        }))
        .filter((p) => Number.isFinite(p.margem))
        .sort((a, b) => b.margem - a.margem)
        .slice(0, 8),
    [produtos],
  );

  const kpis = [
    {
      icon: DollarSign,
      label: "Faturamento",
      value: formatMoneyCompact(metricas.faturamento),
      detail: "Receita concluída no mês",
      tone: "success" as Tone,
      status: metricas.faturamento > 0 ? "Ativo" : "Sem receita",
    },
    {
      icon: TrendingUp,
      label: "Lucro Op.",
      value: formatMoneyCompact(metricas.lucroOperacional),
      detail: "Faturamento menos despesas",
      tone: metricas.lucroOperacional >= 0 ? "success" as Tone : "destructive" as Tone,
      status: metricas.lucroOperacional >= 0 ? "Positivo" : "Atenção",
    },
    {
      icon: Percent,
      label: "Margem",
      value: `${metricas.margemOperacional.toFixed(1)}%`,
      detail: "Eficiência operacional",
      tone: metricas.margemOperacional >= 20 ? "info" as Tone : "warning" as Tone,
      status: metricas.margemOperacional >= 20 ? "Saudável" : "Monitorar",
    },
    {
      icon: ShoppingCart,
      label: "Pedidos",
      value: numberFormatter.format(metricas.totalPedidos),
      detail: "Movimento do período",
      tone: "primary" as Tone,
      status: "Operação",
    },
    {
      icon: DollarSign,
      label: "Ticket Médio",
      value: formatMoney(metricas.ticketMedio),
      detail: "Média por venda concluída",
      tone: "info" as Tone,
      status: "Venda",
    },
    {
      icon: AlertTriangle,
      label: "Despesas",
      value: formatMoneyCompact(metricas.totalDespesas),
      detail: "Compromissos do mês",
      tone: "destructive" as Tone,
      status: "Custo",
    },
    {
      icon: Truck,
      label: "Custo/Entrega",
      value: formatMoney(metricas.custoMedioEntrega),
      detail: "Estimativa operacional",
      tone: "warning" as Tone,
      status: "Logística",
    },
    {
      icon: Users,
      label: "Clientes",
      value: numberFormatter.format(clientes.length),
      detail: "Base cadastrada",
      tone: "secondary" as Tone,
      status: "Carteira",
    },
  ];

  const executiveNotes = [
    {
      label: "Resultado do mês",
      value: metricas.lucroOperacional >= 0 ? "Operação positiva" : "Operação negativa",
      description:
        metricas.lucroOperacional >= 0
          ? `Lucro operacional de ${formatMoney(metricas.lucroOperacional)}.`
          : `Déficit operacional de ${formatMoney(Math.abs(metricas.lucroOperacional))}.`,
      tone: metricas.lucroOperacional >= 0 ? toneStyles.success.soft : toneStyles.destructive.soft,
    },
    {
      label: "Ponto de atenção",
      value: metricas.margemOperacional < 10 ? "Margem baixa" : "Margem controlada",
      description:
        metricas.margemOperacional < 10
          ? "Revisar preços, despesas e mix de produtos."
          : "Acompanhar despesas para preservar a rentabilidade.",
      tone: metricas.margemOperacional < 10 ? toneStyles.warning.soft : toneStyles.info.soft,
    },
    {
      label: "Leitura comercial",
      value: `${numberFormatter.format(metricas.vendasConcluidas.length)} vendas concluídas`,
      description: `Ticket médio atual em ${formatMoney(metricas.ticketMedio)}.`,
      tone: toneStyles.secondary.soft,
    },
  ];

  return (
    <MainLayout>
      <Header
        title="Relatório Gerencial"
        subtitle={`Central Gás - Consolidado de ${format(new Date(), "MMMM yyyy", { locale: ptBR })}`}
      />
      <div className="space-y-5 bg-gradient-to-br from-secondary/10 via-background to-primary/10 p-3 sm:p-4 md:p-6">
        <Tabs defaultValue="graficos" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-auto rounded-xl border bg-background/85 p-1 shadow-sm backdrop-blur">
              <TabsTrigger value="graficos" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <TrendingUp className="h-4 w-4" />
                Gráficos
              </TabsTrigger>
              <TabsTrigger value="relatorio-ia" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Brain className="h-4 w-4" />
                Relatório IA
              </TabsTrigger>
            </TabsList>
            <Badge variant="outline" className="w-fit border-primary/20 bg-background/70 px-3 py-1 text-primary">
              Build executivo - dados do mês atual
            </Badge>
          </div>

          <TabsContent value="graficos" className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-3">
              {executiveNotes.map((note) => (
                <div key={note.label} className={`rounded-xl border p-4 shadow-sm ${note.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{note.label}</p>
                  <p className="mt-1 text-lg font-bold">{note.value}</p>
                  <p className="mt-1 text-sm opacity-80">{note.description}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              {kpis.map((kpi) => (
                <Card key={kpi.label} className="overflow-hidden border-border/70 bg-background/90 shadow-sm">
                  <CardContent className="p-0">
                    <div className={`h-1 ${toneStyles[kpi.tone].bar}`} />
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className={toneStyles[kpi.tone].icon}>
                          <kpi.icon className="h-4 w-4" />
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {kpi.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xl font-bold leading-tight text-foreground">{kpi.value}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{kpi.label}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">{kpi.detail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {loading ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <Card key={item} className="border-border/70 bg-background/90 shadow-sm">
                    <CardContent className="h-[340px] animate-pulse bg-muted/30" />
                  </Card>
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border-border/70 bg-background/95 shadow-sm">
                    <CardHeader className="border-b bg-gradient-to-r from-success/10 to-info/10">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="h-4 w-4 text-success" />
                        Faturamento Diário
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {vendasPorDia.some((item) => item.total > 0) ? (
                        <ResponsiveContainer width="100%" height={270}>
                          <AreaChart data={vendasPorDia}>
                            <defs>
                              <linearGradient id="faturamentoGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
                            <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Number(v) / 1000}k`} />
                            <Tooltip formatter={formatTooltipMoney} labelClassName="font-medium" />
                            <Area type="monotone" dataKey="total" name="Faturamento" stroke="hsl(var(--success))" strokeWidth={3} fill="url(#faturamentoGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart label="As vendas concluídas do mês aparecerão aqui assim que houver movimentação." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-background/95 shadow-sm">
                    <CardHeader className="border-b bg-gradient-to-r from-destructive/10 to-warning/15">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        Despesas por Categoria
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {despesasChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={270}>
                          <PieChart>
                            <Pie data={despesasChart} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={88} innerRadius={48} paddingAngle={2}>
                              {despesasChart.map((_, i) => (
                                <Cell key={i} fill={chartPalette[(i + 3) % chartPalette.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={formatTooltipMoney} />
                            <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart label="As categorias de contas a pagar do período aparecerão neste gráfico." />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border-border/70 bg-background/95 shadow-sm">
                    <CardHeader className="border-b bg-gradient-to-r from-secondary/10 to-info/10">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="h-4 w-4 text-secondary" />
                        Margem por Produto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {topProdutos.length > 0 ? (
                        <ResponsiveContainer width="100%" height={270}>
                          <BarChart data={topProdutos} layout="vertical" margin={{ left: 18, right: 20 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                            <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={118} />
                            <Tooltip formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />
                            <Bar dataKey="margem" name="Margem" radius={[0, 8, 8, 0]}>
                              {topProdutos.map((item, i) => (
                                <Cell key={item.nome} fill={item.margem >= 25 ? "hsl(var(--success))" : chartPalette[i % chartPalette.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart label="Produtos com preço de venda e custo cadastrados serão comparados aqui." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-background/95 shadow-sm">
                    <CardHeader className="border-b bg-gradient-to-r from-info/10 to-secondary/10">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShoppingCart className="h-4 w-4 text-info" />
                        Formas de Pagamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {pagamentoChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={270}>
                          <PieChart>
                            <Pie data={pagamentoChart} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={88} innerRadius={44} paddingAngle={2}>
                              {pagamentoChart.map((_, i) => (
                                <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={chartValueFormatter} />
                            <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart label="As formas de pagamento dos pedidos aparecerão quando houver vendas no mês." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="relatorio-ia" className="space-y-5">
            <Card className="overflow-hidden border-primary/15 bg-background/95 shadow-sm">
              <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-secondary/10 to-info/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Brain className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Relatório Gerencial por IA</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Análise executiva com alertas, oportunidades e recomendações para a operação.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={periodoIA} onValueChange={(v) => setPeriodoIA(v as PeriodoIA)}>
                      <TabsList className="h-9 rounded-lg bg-background/80">
                        <TabsTrigger value="semanal" className="h-8 text-xs">Semanal</TabsTrigger>
                        <TabsTrigger value="mensal" className="h-8 text-xs">Mensal</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button onClick={gerarRelatorioIA} disabled={gerandoIA} size="sm">
                      {gerandoIA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                      {gerandoIA ? "Gerando..." : "Gerar Relatório"}
                    </Button>
                    {relatorioIA && (
                      <Button onClick={exportarPDF} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { icon: TrendingUp, title: "Resultado", text: "Faturamento, lucro, margem e ticket médio.", tone: toneStyles.success.icon },
                    { icon: AlertTriangle, title: "Alertas", text: "Despesas altas, margem baixa e pontos fora da curva.", tone: toneStyles.warning.icon },
                    { icon: Package, title: "Ações", text: "Sugestões práticas para preço, estoque e operação.", tone: toneStyles.secondary.icon },
                  ].map((item) => (
                    <div key={item.title} className="rounded-xl border bg-background p-4">
                      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${item.tone}`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>

                {gerandoIA ? (
                  <div className="rounded-xl border bg-muted/20 p-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <div>
                        <p className="font-semibold">Analisando os dados gerenciais</p>
                        <p className="text-sm text-muted-foreground">A IA está cruzando vendas, despesas, margem e comportamento operacional.</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ) : relatorioIA ? (
                  <div className="rounded-xl border bg-background p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <p className="text-sm font-semibold text-primary">Análise pronta</p>
                        <p className="text-xs text-muted-foreground">
                          Período {periodoIA === "semanal" ? "semanal" : "mensal"} - gerado em {format(new Date(), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                        Recomendações executivas
                      </Badge>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground">
                      <ReactMarkdown>{relatorioIA}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Brain}
                    title="Pronto para gerar uma leitura executiva"
                    description="Gere o relatório para transformar os dados do período em resumo, alertas e próximas ações."
                    action={{
                      label: `Gerar Relatório ${periodoIA === "semanal" ? "Semanal" : "Mensal"}`,
                      onClick: gerarRelatorioIA,
                      icon: Brain,
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

