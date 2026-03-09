import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, AlertTriangle, Lightbulb,
  Target, Users, Package, RefreshCw,
  TrendingUp, Clock, Zap, Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { addDays, format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { AgentDrawer } from "@/components/ai/AgentDrawer";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Insight {
  id: string;
  tipo: "alerta" | "oportunidade" | "insight" | "meta";
  titulo: string;
  descricao: string;
  acao: string;
  prioridade: "alta" | "media" | "baixa";
  valor?: string;
}

interface ProactiveSuggestion {
  id: string;
  icon: React.ElementType;
  label: string;
  prompt: string;
  gradient: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const iconConfig = {
  alerta:       { icon: AlertTriangle, gradient: "from-yellow-500/20 to-orange-500/20", border: "border-yellow-500/30", iconColor: "text-yellow-500" },
  oportunidade: { icon: Users,         gradient: "from-blue-500/20 to-cyan-500/20",     border: "border-blue-500/30",   iconColor: "text-blue-500" },
  insight:      { icon: Lightbulb,     gradient: "from-purple-500/20 to-pink-500/20",   border: "border-purple-500/30", iconColor: "text-purple-500" },
  meta:         { icon: Target,        gradient: "from-red-500/20 to-rose-500/20",      border: "border-red-500/30",    iconColor: "text-red-500" },
};

// ─── Proactive Suggestions Engine ───────────────────────────────────────────

function getProactiveSuggestions(): ProactiveSuggestion[] {
  const hour = new Date().getHours();
  const day = new Date().getDate();
  const suggestions: ProactiveSuggestion[] = [];

  if (hour < 12) {
    suggestions.push(
      { id: "briefing", icon: Sparkles, label: "Briefing do dia", prompt: "Me dê um resumo completo de ontem e os alertas para hoje", gradient: "from-primary/10 to-primary/5" },
      { id: "pendentes", icon: Clock, label: "Pedidos pendentes", prompt: "Quantos pedidos estão pendentes agora?", gradient: "from-yellow-500/10 to-amber-500/5" },
    );
  } else if (hour < 18) {
    suggestions.push(
      { id: "vendas-hoje", icon: TrendingUp, label: "Vendas de hoje", prompt: "Qual o faturamento de hoje até agora? Compare com ontem", gradient: "from-emerald-500/10 to-green-500/5" },
      { id: "entregas", icon: Zap, label: "Status entregas", prompt: "Quantos entregadores estão em rota e quantas entregas pendentes?", gradient: "from-blue-500/10 to-cyan-500/5" },
    );
  } else {
    suggestions.push(
      { id: "fechamento", icon: Shield, label: "Fechamento do dia", prompt: "Resumo do dia: vendas, entregas, caixa e pendências", gradient: "from-indigo-500/10 to-violet-500/5" },
      { id: "amanha", icon: Target, label: "Preparar amanhã", prompt: "Quais produtos estão em risco de ruptura e quais contas vencem amanhã?", gradient: "from-rose-500/10 to-pink-500/5" },
    );
  }

  if (day >= 25) {
    suggestions.push(
      { id: "mes", icon: TrendingUp, label: "Resumo do mês", prompt: "Resumo financeiro do mês: faturamento, despesas e resultado", gradient: "from-amber-500/10 to-yellow-500/5" },
    );
  }

  suggestions.push(
    { id: "top-produtos", icon: Package, label: "Top produtos", prompt: "Quais os 5 produtos mais vendidos este mês?", gradient: "from-purple-500/10 to-fuchsia-500/5" },
  );

  return suggestions.slice(0, 4);
}

// ─── Custom Hooks for Data ──────────────────────────────────────────────────

function useInsightsData(unidadeId?: string) {
  const rupturas = useQuery({
    queryKey: ["conselhos-rupturas", unidadeId],
    queryFn: async () => {
      let q = (supabase as any).from("vw_previsao_ruptura")
        .select("nome, estoque, dias_ate_ruptura, situacao")
        .neq("situacao", "ok")
        .order("dias_ate_ruptura", { ascending: true, nullsFirst: false })
        .limit(5);
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const clientesInativos = useQuery({
    queryKey: ["conselhos-inativos", unidadeId],
    queryFn: async () => {
      const limite = subDays(new Date(), 30).toISOString();
      let q = supabase.from("pedidos")
        .select("cliente_id, clientes:cliente_id(nome), created_at")
        .neq("status", "cancelado")
        .order("created_at", { ascending: false });
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data: pedidos } = await q.limit(2000);
      if (!pedidos) return [];
      const ultimoPorCliente: Record<string, { nome: string; data: string }> = {};
      for (const p of pedidos as any[]) {
        if (!ultimoPorCliente[p.cliente_id]) {
          ultimoPorCliente[p.cliente_id] = { nome: p.clientes?.nome || "—", data: p.created_at };
        }
      }
      return Object.values(ultimoPorCliente).filter(c => c.data < limite).slice(0, 5);
    },
  });

  const contasVencendo = useQuery({
    queryKey: ["conselhos-contas", unidadeId],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const em3dias = format(addDays(new Date(), 3), "yyyy-MM-dd");
      let q = supabase.from("contas_pagar")
        .select("descricao, fornecedor, valor, vencimento")
        .eq("status", "pendente")
        .gte("vencimento", hoje).lte("vencimento", em3dias)
        .order("vencimento", { ascending: true });
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const metas = useQuery({
    queryKey: ["conselhos-metas", unidadeId],
    queryFn: async () => {
      const { data } = await supabase.from("metas")
        .select("titulo, tipo, valor_objetivo, valor_atual, status, prazo")
        .in("status", ["em_andamento", "ativa"])
        .order("prazo", { ascending: true }).limit(3);
      return (data || []) as any[];
    },
  });

  const alertasCnh = useQuery({
    queryKey: ["conselhos-cnh", unidadeId],
    queryFn: async () => {
      let q = supabase.from("vw_alertas_cnh").select("*");
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const diferencaCaixa = useQuery({
    queryKey: ["conselhos-caixa", unidadeId],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      let q = supabase.from("vw_conferencia_caixa").select("*")
        .eq("data", hoje).eq("sessao_status", "aberto");
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data } = await q.limit(1);
      return (data || []) as any[];
    },
  });

  const isLoading = rupturas.isLoading || clientesInativos.isLoading || contasVencendo.isLoading || metas.isLoading || alertasCnh.isLoading || diferencaCaixa.isLoading;

  return {
    rupturas: rupturas.data || [],
    clientesInativos: clientesInativos.data || [],
    contasVencendo: contasVencendo.data || [],
    metas: metas.data || [],
    alertasCnh: alertasCnh.data || [],
    diferencaCaixa: diferencaCaixa.data || [],
    isLoading,
  };
}

// ─── Insights Builder ───────────────────────────────────────────────────────

function buildInsights(data: ReturnType<typeof useInsightsData>): Insight[] {
  const list: Insight[] = [];
  const { rupturas, clientesInativos, contasVencendo, metas, alertasCnh, diferencaCaixa } = data;

  for (const r of rupturas) {
    const dias = r.dias_ate_ruptura;
    list.push({
      id: `ruptura-${r.nome}`,
      tipo: "alerta",
      titulo: `Ruptura iminente: ${r.nome}`,
      descricao: dias === 0
        ? `Estoque zerado. Compra urgente necessária.`
        : `Estoque (${r.estoque} un) zera em ${dias} dia${dias !== 1 ? "s" : ""}.`,
      acao: "Registrar compra",
      prioridade: dias !== null && dias <= 2 ? "alta" : "media",
    });
  }

  if (clientesInativos.length > 0) {
    const nomes = clientesInativos.slice(0, 3).map((c: any) => c.nome).join(", ");
    list.push({
      id: "clientes-inativos",
      tipo: "oportunidade",
      titulo: `${clientesInativos.length} cliente${clientesInativos.length > 1 ? "s" : ""} inativo${clientesInativos.length > 1 ? "s" : ""}`,
      descricao: `${nomes}${clientesInativos.length > 3 ? ` +${clientesInativos.length - 3}` : ""} sem pedidos há 30+ dias.`,
      acao: "Criar campanha",
      prioridade: clientesInativos.length >= 5 ? "alta" : "media",
    });
  }

  if (contasVencendo.length > 0) {
    const total = contasVencendo.reduce((s: number, c: any) => s + (c.valor || 0), 0);
    list.push({
      id: "contas-vencendo",
      tipo: "insight",
      titulo: `${contasVencendo.length} conta${contasVencendo.length > 1 ? "s" : ""} vencem em 3 dias`,
      descricao: `Total R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      acao: "Ver contas",
      prioridade: "alta",
      valor: `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    });
  }

  for (const m of metas) {
    const pct = m.valor_objetivo > 0 ? Math.round((m.valor_atual / m.valor_objetivo) * 100) : 0;
    const dias = m.prazo ? Math.ceil((new Date(m.prazo).getTime() - Date.now()) / 86400000) : null;
    if (pct < 80) {
      list.push({
        id: `meta-${m.titulo}`,
        tipo: "meta",
        titulo: `Meta "${m.titulo}" em risco`,
        descricao: `${pct}% concluído${dias !== null ? ` • ${dias}d restantes` : ""}`,
        acao: "Ver estratégias",
        prioridade: pct < 50 ? "alta" : "media",
      });
    }
  }

  for (const cnh of alertasCnh) {
    if (cnh.situacao !== "ok") {
      list.push({
        id: `cnh-${cnh.id}`,
        tipo: "alerta",
        titulo: `CNH ${cnh.situacao === "vencida" ? "Vencida" : "Vencendo"}: ${cnh.nome}`,
        descricao: cnh.situacao === "vencida" ? "Atualize o cadastro imediatamente." : `${cnh.dias_restantes} dias para vencimento.`,
        acao: "Ver entregador",
        prioridade: cnh.situacao === "vencida" ? "alta" : "media",
      });
    }
  }

  if (diferencaCaixa.length > 0 && diferencaCaixa[0].diferenca_calculada !== 0) {
    const caixa = diferencaCaixa[0];
    list.push({
      id: `caixa-${caixa.sessao_id}`,
      tipo: "alerta",
      titulo: "Divergência no Caixa",
      descricao: `Diferença de R$ ${Math.abs(caixa.diferenca_calculada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      acao: "Conferir caixa",
      prioridade: "alta",
      valor: `R$ ${caixa.diferenca_calculada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    });
  }

  return list;
}

// ─── InsightCard Component ──────────────────────────────────────────────────

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = iconConfig[insight.tipo];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
    >
      <Card className={`group relative overflow-hidden hover:shadow-lg transition-all duration-300 ${insight.prioridade === "alta" ? config.border : "border-border"}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        <CardHeader className="pb-2 relative">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${config.gradient} shrink-0`}>
              <Icon className={`h-4 w-4 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight truncate">{insight.titulo}</CardTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  variant={insight.prioridade === "alta" ? "destructive" : "secondary"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {insight.prioridade === "alta" ? "Urgente" : "Atenção"}
                </Badge>
                {insight.valor && (
                  <span className="text-xs font-bold text-destructive">{insight.valor}</span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative pt-0">
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{insight.descricao}</p>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            {insight.acao}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConselhosIA() {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const data = useInsightsData(unidadeAtual?.id);
  const insights = useMemo(() => buildInsights(data), [data]);
  const suggestions = useMemo(() => getProactiveSuggestions(), []);

  const altaPrioridade = insights.filter(i => i.prioridade === "alta").length;

  const refresh = () => {
    ["conselhos-rupturas", "conselhos-inativos", "conselhos-contas", "conselhos-metas", "conselhos-cnh", "conselhos-caixa"]
      .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <MainLayout>
      <Header title="Central de Inteligência" subtitle="Insights, alertas e agente IA em tempo real" />
      <div className="p-3 sm:p-4 md:p-6 space-y-6">

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border border-primary/10 p-6"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">{greeting}! Aqui está seu painel.</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {data.isLoading ? "Analisando dados..." : (
                  altaPrioridade > 0
                    ? `⚠️ ${altaPrioridade} alerta${altaPrioridade > 1 ? "s" : ""} urgente${altaPrioridade > 1 ? "s" : ""} requer${altaPrioridade === 1 ? "" : "em"} atenção.`
                    : "✅ Tudo sob controle. Sem alertas críticos."
                )}
              </p>
            </div>
            <Button onClick={refresh} disabled={data.isLoading} variant="outline" size="sm" className="shrink-0">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${data.isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </motion.div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Insights Ativos", value: insights.length, icon: Sparkles, color: "text-primary" },
            { label: "Urgentes", value: altaPrioridade, icon: AlertTriangle, color: altaPrioridade > 0 ? "text-destructive" : "text-muted-foreground" },
            { label: "Clientes Inativos", value: data.clientesInativos.length, icon: Users, color: "text-blue-500" },
            { label: "Produtos em Risco", value: data.rupturas.length, icon: Package, color: "text-orange-500" },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <div>
                    {data.isLoading ? (
                      <Skeleton className="h-6 w-10 mb-0.5" />
                    ) : (
                      <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Proactive Suggestions */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            💡 Sugestões para agora
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {suggestions.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className={`p-3 rounded-xl border border-border/50 bg-gradient-to-br ${s.gradient} text-left hover:shadow-md hover:border-primary/20 transition-all duration-200 group`}
                onClick={() => {
                  // Open agent with this prompt - dispatch custom event
                  window.dispatchEvent(new CustomEvent("agent-prompt", { detail: s.prompt }));
                }}
              >
                <s.icon className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-medium">{s.label}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Insights Grid */}
        {data.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="pt-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-7 w-24 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="p-4 rounded-full bg-primary/5">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <p className="font-semibold text-lg">Tudo em ordem! 🎉</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Nenhum alerta crítico. Estoque confortável, clientes ativos e contas em dia.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {insights.map((insight, i) => (
                <InsightCard key={insight.id} insight={insight} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Floating Agent */}
      <AgentDrawer />
    </MainLayout>
  );
}
