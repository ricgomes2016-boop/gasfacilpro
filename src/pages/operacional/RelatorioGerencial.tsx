import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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

      let prodQ = supabase.from("produtos").select("id, nome, preco, preco_custo, estoque_atual");
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
        .filter((p) => p.preco && p.preco_custo)
        .map((p) => ({
          nome: p.nome || "Produto",
          margem: ((asNumber(p.preco) - asNumber(p.preco_custo)) / asNumber(p.preco)) * 100,
          estoque: p.estoque_atual || 0,
        }))
        .filter((p) => Number.isFinite(p.margem))
        .sort((a, b) => b.margem - a.margem)
        .slice(0, 8),
    [produtos],
  );

  const kpis = [
    {
      key: "faturamento",
      icon: DollarSign,
      label: "Faturamento",
      value: formatMoneyCompact(metricas.faturamento),
      detail: "Receita concluída no mês",
      tone: "success" as Tone,
      status: metricas.faturamento > 0 ? "Ativo" : "Sem receita",
    },
    {
      key: "lucro",
      icon: TrendingUp,
      label: "Lucro Op.",
      value: formatMoneyCompact(metricas.lucroOperacional),
      detail: "Faturamento menos despesas",
      tone: metricas.lucroOperacional >= 0 ? "success" as Tone : "destructive" as Tone,
      status: metricas.lucroOperacional >= 0 ? "Positivo" : "Atenção",
    },
    {
      key: "margem",
      icon: Percent,
      label: "Margem",
      value: `${metricas.margemOperacional.toFixed(1)}%`,
      detail: "Eficiência operacional",
      tone: metricas.margemOperacional >= 20 ? "info" as Tone : "warning" as Tone,
      status: metricas.margemOperacional >= 20 ? "Saudável" : "Monitorar",
    },
    {
      key: "pedidos",
      icon: ShoppingCart,
      label: "Pedidos",
      value: numberFormatter.format(metricas.totalPedidos),
      detail: "Movimento do período",
      tone: "primary" as Tone,
      status: "Operação",
    },
    {
      key: "ticket",
      icon: DollarSign,
      label: "Ticket Médio",
      value: formatMoney(metricas.ticketMedio),
      detail: "Média por venda concluída",
      tone: "info" as Tone,
      status: "Venda",
    },
    {
      key: "despesas",
      icon: AlertTriangle,
      label: "Despesas",
      value: formatMoneyCompact(metricas.totalDespesas),
      detail: "Compromissos do mês",
      tone: "destructive" as Tone,
      status: "Custo",
    },
    {
      key: "custo_entrega",
      icon: Truck,
      label: "Custo/Entrega",
      value: formatMoney(metricas.custoMedioEntrega),
      detail: "Estimativa operacional",
      tone: "warning" as Tone,
      status: "Logística",
    },
    {
      key: "clientes",
      icon: Users,
      label: "Clientes",
      value: numberFormatter.format(clientes.length),
      detail: "Base cadastrada",
      tone: "secondary" as Tone,
      status: "Carteira",
    },
  ] as const;

  type KpiKey = typeof kpis[number]["key"];
  const [drillKey, setDrillKey] = useState<KpiKey | null>(null);
  const activeKpi = kpis.find((k) => k.key === drillKey) || null;

  const drillContent = useMemo(() => {
    if (!drillKey) return null;
    const vendasConcluidas = metricas.vendasConcluidas;
    const vendasOrd = [...vendasConcluidas].sort(
      (a, b) => asNumber(b.valor_total) - asNumber(a.valor_total),
    );
    const pedidosOrd = [...vendas].sort(
      (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
    );
    const despesasOrd = [...despesas].sort((a, b) => asNumber(b.valor) - asNumber(a.valor));

    switch (drillKey) {
      case "faturamento":
      case "ticket":
        return {
          summary: [
            { label: "Vendas concluídas", value: numberFormatter.format(vendasConcluidas.length) },
            { label: "Faturamento", value: formatMoney(metricas.faturamento) },
            { label: "Ticket médio", value: formatMoney(metricas.ticketMedio) },
          ],
          list: vendasOrd.slice(0, 50).map((v) => ({
            id: v.id,
            title: `Pedido · ${v.forma_pagamento || "sem forma"}`,
            subtitle: v.created_at ? format(new Date(v.created_at), "dd/MM HH:mm") : "—",
            value: formatMoney(asNumber(v.valor_total)),
            tone: "success" as const,
          })),
          empty: "Nenhuma venda concluída no período.",
        };
      case "lucro":
      case "margem":
        return {
          summary: [
            { label: "Faturamento", value: formatMoney(metricas.faturamento) },
            { label: "Despesas", value: `- ${formatMoney(metricas.totalDespesas)}` },
            {
              label: "Lucro operacional",
              value: formatMoney(metricas.lucroOperacional),
              highlight: true,
            },
            { label: "Margem", value: `${metricas.margemOperacional.toFixed(1)}%` },
          ],
          list: [
            ...vendasOrd.slice(0, 20).map((v) => ({
              id: `v-${v.id}`,
              title: `Venda · ${v.forma_pagamento || "sem forma"}`,
              subtitle: v.created_at ? format(new Date(v.created_at), "dd/MM") : "—",
              value: `+ ${formatMoney(asNumber(v.valor_total))}`,
              tone: "success" as const,
            })),
            ...despesasOrd.slice(0, 20).map((d) => ({
              id: `d-${d.id}`,
              title: d.categoria || "Despesa",
              subtitle: d.vencimento ? format(new Date(d.vencimento), "dd/MM") : "—",
              value: `- ${formatMoney(asNumber(d.valor))}`,
              tone: "destructive" as const,
            })),
          ],
          empty: "Sem movimentações no período.",
        };
      case "pedidos":
        return {
          summary: [
            { label: "Total de pedidos", value: numberFormatter.format(metricas.totalPedidos) },
            { label: "Concluídos", value: numberFormatter.format(vendasConcluidas.length) },
            {
              label: "Cancelados",
              value: numberFormatter.format(
                vendas.filter((v) => v.status === "cancelado").length,
              ),
            },
          ],
          list: pedidosOrd.slice(0, 60).map((v) => ({
            id: v.id,
            title: `Pedido · ${v.status || "—"}`,
            subtitle: v.created_at ? format(new Date(v.created_at), "dd/MM HH:mm") : "—",
            value: formatMoney(asNumber(v.valor_total)),
            tone:
              v.status === "cancelado"
                ? ("destructive" as const)
                : ("success" as const),
          })),
          empty: "Nenhum pedido no período.",
        };
      case "despesas": {
        const byCat = despesas.reduce((acc: Record<string, number>, d) => {
          const c = d.categoria || "Outros";
          acc[c] = (acc[c] || 0) + asNumber(d.valor);
          return acc;
        }, {});
        return {
          summary: [
            { label: "Total despesas", value: formatMoney(metricas.totalDespesas) },
            { label: "Lançamentos", value: numberFormatter.format(despesas.length) },
            { label: "Categorias", value: numberFormatter.format(Object.keys(byCat).length) },
          ],
          list: [
            ...Object.entries(byCat)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, total]) => ({
                id: `cat-${cat}`,
                title: cat,
                subtitle: "Categoria",
                value: formatMoney(total),
                tone: "destructive" as const,
              })),
            ...despesasOrd.slice(0, 30).map((d) => ({
              id: `d-${d.id}`,
              title: d.categoria || "Despesa",
              subtitle: d.vencimento ? format(new Date(d.vencimento), "dd/MM") : "—",
              value: formatMoney(asNumber(d.valor)),
              tone: "muted" as const,
            })),
          ],
          empty: "Nenhuma despesa no período.",
        };
      }
      case "custo_entrega":
        return {
          summary: [
            { label: "Custo médio/entrega", value: formatMoney(metricas.custoMedioEntrega) },
            { label: "Vendas concluídas", value: numberFormatter.format(vendasConcluidas.length) },
            { label: "Base (30% das despesas)", value: formatMoney(metricas.totalDespesas * 0.3) },
          ],
          list: [],
          empty:
            "Estimativa calculada como 30% das despesas do período dividido pelo número de vendas concluídas.",
        };
      case "clientes": {
        const cliOrd = [...clientes].sort((a, b) =>
          (b.created_at || "").localeCompare(a.created_at || ""),
        );
        return {
          summary: [
            { label: "Base cadastrada", value: numberFormatter.format(clientes.length) },
          ],
          list: cliOrd.slice(0, 60).map((c) => ({
            id: c.id,
            title: c.nome || "Cliente",
            subtitle: c.created_at
              ? `Cadastrado em ${format(new Date(c.created_at), "dd/MM/yyyy")}`
              : "—",
            value: "",
            tone: "muted" as const,
          })),
          empty: "Nenhum cliente cadastrado.",
        };
      }
      default:
        return null;
    }
  }, [drillKey, metricas, vendas, despesas, clientes]);

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

  const margemBarWidth = Math.min(100, Math.max(0, metricas.margemOperacional));
  const isLucroPositivo = metricas.lucroOperacional >= 0;

  return (
    <MainLayout>
      <Header
        title="Relatório Gerencial"
        subtitle={`Consolidado de ${format(new Date(), "MMMM yyyy", { locale: ptBR })}`}
      />
      <div className="min-h-screen bg-[#F5F6F8] pb-8">
        <Tabs defaultValue="graficos" className="space-y-4">
          {/* Hero — Lucro Operacional (âncora) */}
          <div className="px-3 pt-3 sm:px-4 sm:pt-4">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(158,84%,17%)] to-[hsl(160,71%,26%)] p-5 text-white shadow-xl shadow-emerald-900/10 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#c9a84c]/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-100/80">
                  Lucro Operacional
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    isLucroPositivo
                      ? "border-emerald-400/30 bg-emerald-400/20 text-emerald-100"
                      : "border-red-300/40 bg-red-400/20 text-red-100"
                  }`}
                >
                  {isLucroPositivo ? "Positivo" : "Atenção"}
                </span>
              </div>
              <h1 className="relative mt-1 font-bold tracking-tight text-3xl sm:text-4xl">
                {formatMoneyCompact(metricas.lucroOperacional)}
              </h1>
              <div className="relative mt-3 flex items-center gap-3">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-[#c9a84c] transition-all duration-500"
                    style={{ width: `${margemBarWidth}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-emerald-50 sm:text-sm">
                  Margem: <span className="text-[#c9a84c]">{metricas.margemOperacional.toFixed(1)}%</span>
                </span>
              </div>
            </div>
          </div>

          {/* KPIs Grid — 2 cols mobile, expande no desktop */}
          <div className="grid grid-cols-2 gap-2.5 px-3 sm:gap-3 sm:px-4 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
            {kpis.map((kpi) => (
              <button
                type="button"
                key={kpi.label}
                onClick={() => setDrillKey(kpi.key)}
                className="group text-left rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[hsl(158,84%,17%)]/30 sm:p-4"
                aria-label={`Ver detalhes de ${kpi.label}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={toneStyles[kpi.tone].icon}>
                    <kpi.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-tight text-slate-500 sm:text-[10px]">
                    {kpi.status}
                  </span>
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-tight text-slate-500 sm:text-[11px]">
                  {kpi.label}
                </p>
                <p className="mt-0.5 text-base font-bold leading-tight text-[hsl(158,84%,17%)] sm:text-lg">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-400 line-clamp-2 sm:text-[11px]">
                  {kpi.detail}
                </p>
                <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-tight text-[hsl(158,84%,17%)]/70 opacity-0 transition-opacity group-hover:opacity-100 sm:text-[10px]">
                  Toque para detalhes →
                </p>
              </button>
            ))}
          </div>

          {/* Sticky Tabs */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-[#F5F6F8]/90 px-3 backdrop-blur-md sm:px-4">
            <TabsList className="h-auto rounded-none border-0 bg-transparent p-0">
              <TabsTrigger
                value="graficos"
                className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-bold text-slate-400 shadow-none data-[state=active]:border-[hsl(158,84%,17%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(158,84%,17%)] data-[state=active]:shadow-none"
              >
                <TrendingUp className="h-4 w-4" />
                Gráficos
              </TabsTrigger>
              <TabsTrigger
                value="relatorio-ia"
                className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-medium text-slate-400 shadow-none data-[state=active]:border-[hsl(158,84%,17%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(158,84%,17%)] data-[state=active]:shadow-none"
              >
                <Brain className="h-4 w-4" />
                Relatório IA
                <span className="ml-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                  BETA
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="graficos" className="space-y-4 px-3 sm:px-4">
            {/* Notas Executivas */}
            <div>
              <h3 className="mb-2 ml-1 text-sm font-bold text-slate-800">Notas Executivas</h3>
              <div className="grid gap-2.5 md:grid-cols-3">
                {executiveNotes.map((note) => (
                  <div
                    key={note.label}
                    className={`rounded-2xl border p-3.5 shadow-sm ${note.tone}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                        {note.label}
                      </p>
                    </div>
                    <p className="mt-1.5 text-sm font-bold">{note.value}</p>
                    <p className="mt-0.5 text-xs leading-relaxed opacity-80">{note.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-[300px] animate-pulse rounded-3xl border border-slate-100 bg-white"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Faturamento Diário */}
                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
                      <DollarSign className="h-4 w-4 text-[hsl(160,71%,26%)]" />
                      Faturamento Diário
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                      30 dias
                    </span>
                  </div>
                  {vendasPorDia.some((item) => item.total > 0) ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={vendasPorDia}>
                        <defs>
                          <linearGradient id="faturamentoGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(160,71%,26%)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="hsl(160,71%,26%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Number(v) / 1000}k`} width={40} />
                        <Tooltip formatter={formatTooltipMoney} labelClassName="font-medium" />
                        <Area
                          type="monotone"
                          dataKey="total"
                          name="Faturamento"
                          stroke="hsl(160,71%,26%)"
                          strokeWidth={2.5}
                          fill="url(#faturamentoGradient)"
                          activeDot={{ r: 6, fill: "hsl(160,71%,26%)", stroke: "white", strokeWidth: 2, className: "pulse" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="As vendas concluídas do mês aparecerão aqui assim que houver movimentação." />
                  )}
                </div>

                {/* Despesas por Categoria */}
                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Despesas por Categoria
                    </h3>
                  </div>
                  {despesasChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={despesasChart} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={78} innerRadius={44} paddingAngle={2}>
                          {despesasChart.map((_, i) => (
                            <Cell key={i} fill={chartPalette[(i + 3) % chartPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={formatTooltipMoney} />
                        <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="As categorias de contas a pagar do período aparecerão neste gráfico." />
                  )}
                </div>

                {/* Margem por Produto */}
                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
                      <Package className="h-4 w-4 text-[hsl(158,84%,17%)]" />
                      Margem por Produto
                    </h3>
                  </div>
                  {topProdutos.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topProdutos} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                        <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                        <Tooltip formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />
                        <Bar dataKey="margem" name="Margem" radius={[0, 8, 8, 0]}>
                          {topProdutos.map((item, i) => (
                            <Cell key={item.nome} fill={item.margem >= 25 ? "hsl(160,71%,26%)" : chartPalette[i % chartPalette.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Produtos com preço de venda e custo cadastrados serão comparados aqui." />
                  )}
                </div>

                {/* Formas de Pagamento */}
                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
                      <ShoppingCart className="h-4 w-4 text-info" />
                      Formas de Pagamento
                    </h3>
                  </div>
                  {pagamentoChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pagamentoChart} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={78} innerRadius={40} paddingAngle={2}>
                          {pagamentoChart.map((_, i) => (
                            <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={chartValueFormatter} />
                        <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="As formas de pagamento dos pedidos aparecerão quando houver vendas no mês." />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="relatorio-ia" className="space-y-4 px-3 sm:px-4">
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-br from-[hsl(158,84%,17%)]/5 to-[hsl(160,71%,26%)]/5 p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[hsl(158,84%,17%)]/10 p-2.5 text-[hsl(158,84%,17%)]">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-slate-800 sm:text-lg">Relatório por IA</h2>
                      <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                        Análise executiva com alertas e recomendações.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={periodoIA} onValueChange={(v) => setPeriodoIA(v as PeriodoIA)}>
                      <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                        <TabsTrigger value="semanal" className="h-7 rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Semanal
                        </TabsTrigger>
                        <TabsTrigger value="mensal" className="h-7 rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Mensal
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button
                      onClick={gerarRelatorioIA}
                      disabled={gerandoIA}
                      size="sm"
                      className="h-9 rounded-xl bg-[hsl(158,84%,17%)] text-white hover:bg-[hsl(160,71%,26%)]"
                    >
                      {gerandoIA ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Brain className="mr-1.5 h-4 w-4" />}
                      {gerandoIA ? "Gerando..." : "Gerar"}
                    </Button>
                    {relatorioIA && (
                      <Button onClick={exportarPDF} variant="outline" size="sm" className="h-9 rounded-xl">
                        <Download className="mr-1.5 h-4 w-4" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="grid gap-2.5 md:grid-cols-3">
                  {[
                    { icon: TrendingUp, title: "Resultado", text: "Faturamento, lucro, margem e ticket médio.", tone: toneStyles.success.icon },
                    { icon: AlertTriangle, title: "Alertas", text: "Despesas altas, margem baixa e outliers.", tone: toneStyles.warning.icon },
                    { icon: Package, title: "Ações", text: "Sugestões para preço, estoque e operação.", tone: toneStyles.secondary.icon },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${item.tone}`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.text}</p>
                    </div>
                  ))}
                </div>

                {gerandoIA ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-[hsl(158,84%,17%)]" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">Analisando os dados gerenciais</p>
                        <p className="text-xs text-slate-500">Cruzando vendas, despesas, margem e operação.</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                    </div>
                  </div>
                ) : relatorioIA ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[hsl(158,84%,17%)]">Análise pronta</p>
                        <p className="text-[11px] text-slate-500 sm:text-xs">
                          Período {periodoIA === "semanal" ? "semanal" : "mensal"} · {format(new Date(), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[hsl(158,84%,17%)]">
                        Executivo
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
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Drill-down KPI Dialog */}
      <Dialog open={!!drillKey} onOpenChange={(o) => !o && setDrillKey(null)}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0">
          {activeKpi && drillContent && (
            <>
              <DialogHeader className="border-b border-slate-100 bg-gradient-to-br from-[hsl(158,84%,17%)] to-[hsl(160,71%,26%)] p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/15 p-2.5 text-white">
                    <activeKpi.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-base font-bold text-white sm:text-lg">
                      {activeKpi.label}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-emerald-100/80">
                      {activeKpi.detail}
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold sm:text-2xl">{activeKpi.value}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50/60 p-4">
                {drillContent.summary.map((s) => (
                  <div key={s.label} className="min-w-0">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-tight text-slate-500">
                      {s.label}
                    </p>
                    <p
                      className={`mt-0.5 truncate text-sm font-bold ${
                        (s as { highlight?: boolean }).highlight
                          ? "text-[hsl(158,84%,17%)]"
                          : "text-slate-800"
                      }`}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <ScrollArea className="max-h-[55vh]">
                <div className="p-4">
                  {drillContent.list.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      {drillContent.empty}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {drillContent.list.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {item.title}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {item.subtitle}
                            </p>
                          </div>
                          {item.value && (
                            <span
                              className={`shrink-0 text-sm font-bold ${
                                item.tone === "success"
                                  ? "text-[hsl(158,84%,17%)]"
                                  : item.tone === "destructive"
                                    ? "text-destructive"
                                    : "text-slate-700"
                              }`}
                            >
                              {item.value}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

