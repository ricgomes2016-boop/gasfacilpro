import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, AlertTriangle, Lightbulb,
  Target, Users, Package, RefreshCw, ShieldAlert, Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { addDays, format, subDays } from "date-fns";

interface Insight {
  id: string;
  tipo: "alerta" | "oportunidade" | "insight" | "meta";
  titulo: string;
  descricao: string;
  acao: string;
  prioridade: "alta" | "media" | "baixa";
  valor?: string;
}

const iconConfig = {
  alerta:       { icon: AlertTriangle, color: "text-yellow-500",  bg: "bg-yellow-500/10"  },
  oportunidade: { icon: Users,         color: "text-blue-500",    bg: "bg-blue-500/10"    },
  insight:      { icon: Lightbulb,     color: "text-purple-500",  bg: "bg-purple-500/10"  },
  meta:         { icon: Target,        color: "text-red-500",     bg: "bg-red-500/10"     },
};

export default function ConselhosIA() {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();

  // 1. Alertas de ruptura de estoque
  const { data: rupturas = [], isLoading: loadingRupturas } = useQuery({
    queryKey: ["conselhos-rupturas", unidadeAtual?.id],
    queryFn: async () => {
      let q = (supabase.from as any)("vw_previsao_ruptura")
        .select("nome, estoque, dias_ate_ruptura, situacao")
        .neq("situacao", "ok")
        .order("dias_ate_ruptura", { ascending: true, nullsFirst: false })
        .limit(5);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  // 2. Clientes inativos (sem pedido há 30 dias)
  const { data: clientesInativos = [], isLoading: loadingInativos } = useQuery({
    queryKey: ["conselhos-inativos", unidadeAtual?.id],
    queryFn: async () => {
      const limite = subDays(new Date(), 30).toISOString();
      let q = supabase
        .from("pedidos")
        .select("cliente_id, clientes:cliente_id(nome), created_at")
        .neq("status", "cancelado")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data: pedidos } = await q.limit(2000);
      if (!pedidos) return [];
      const ultimoPorCliente: Record<string, { nome: string; data: string }> = {};
      for (const p of pedidos as any[]) {
        if (!ultimoPorCliente[p.cliente_id]) {
          ultimoPorCliente[p.cliente_id] = {
            nome: p.clientes?.nome || "Nome não informado",
            data: p.created_at,
          };
        }
      }
      return Object.values(ultimoPorCliente)
        .filter(c => c.data < limite)
        .slice(0, 5);
    },
  });

  // 3. Contas a pagar vencendo em 3 dias
  const { data: contasVencendo = [], isLoading: loadingContas } = useQuery({
    queryKey: ["conselhos-contas", unidadeAtual?.id],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const em3dias = format(addDays(new Date(), 3), "yyyy-MM-dd");
      let q = supabase
        .from("contas_pagar")
        .select("descricao, fornecedor, valor, vencimento")
        .eq("status", "pendente")
        .gte("vencimento", hoje)
        .lte("vencimento", em3dias)
        .order("vencimento", { ascending: true });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  // 4. Metas em andamento
  const { data: metas = [], isLoading: loadingMetas } = useQuery({
    queryKey: ["conselhos-metas", unidadeAtual?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("titulo, tipo, valor_objetivo, valor_atual, status, prazo")
        .in("status", ["em_andamento", "ativa"])
        .order("prazo", { ascending: true })
        .limit(3);
      return (data || []) as any[];
    },
  });

  // 5. Alertas de CNH (vw_alertas_cnh)
  const { data: alertasCnh = [], isLoading: loadingCnh } = useQuery({
    queryKey: ["conselhos-cnh", unidadeAtual?.id],
    queryFn: async () => {
      let q = (supabase.from as any)("vw_alertas_cnh")
        .select("*")
        .in("situacao", ["vencida", "vence_30d"])
        .limit(10);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  // 6. Conferência de caixa (vw_conferencia_caixa)
  const { data: conferenciaCaixa = [], isLoading: loadingCaixa } = useQuery({
    queryKey: ["conselhos-caixa", unidadeAtual?.id],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      let q = (supabase.from as any)("vw_conferencia_caixa")
        .select("*")
        .eq("data", hoje);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const isLoading = loadingRupturas || loadingInativos || loadingContas || loadingMetas || loadingCnh || loadingCaixa;

  // Montar lista de insights a partir dos dados reais
  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = [];

    // Alertas de ruptura
    for (const r of rupturas) {
      const dias = r.dias_ate_ruptura;
      list.push({
        id: `ruptura-${r.nome}`,
        tipo: "alerta",
        titulo: `Ruptura iminente: ${r.nome}`,
        descricao: dias === 0
          ? `O estoque de ${r.nome} está zerado agora. Compra urgente necessária.`
          : `O estoque de ${r.nome} (${r.estoque} un) vai zerar em ${dias} dia${dias !== 1 ? "s" : ""} no ritmo atual de vendas.`,
        acao: "Registrar compra",
        prioridade: dias !== null && dias <= 2 ? "alta" : "media",
      });
    }

    // Clientes inativos
    if (clientesInativos.length > 0) {
      const nomes = clientesInativos.slice(0, 3).map((c: any) => c.nome).join(", ");
      list.push({
        id: "clientes-inativos",
        tipo: "oportunidade",
        titulo: `${clientesInativos.length} cliente${clientesInativos.length > 1 ? "s" : ""} inativo${clientesInativos.length > 1 ? "s" : ""} há 30+ dias`,
        descricao: `${nomes}${clientesInativos.length > 3 ? ` e mais ${clientesInativos.length - 3}` : ""} não fazem pedidos há mais de 30 dias. Uma oferta pode reativá-los.`,
        acao: "Criar campanha de reativação",
        prioridade: clientesInativos.length >= 5 ? "alta" : "media",
      });
    }

    // Contas vencendo
    if (contasVencendo.length > 0) {
      const totalValor = contasVencendo.reduce((s: number, c: any) => s + (c.valor || 0), 0);
      const porVencer = contasVencendo[0];
      list.push({
        id: "contas-vencendo",
        tipo: "insight",
        titulo: `${contasVencendo.length} conta${contasVencendo.length > 1 ? "s" : ""} vencem nos próximos 3 dias`,
        descricao: `Total de R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} a pagar. A mais próxima: "${porVencer.descricao || porVencer.fornecedor}" vence em ${new Date(porVencer.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}.`,
        acao: "Ver contas a pagar",
        prioridade: "alta",
        valor: `R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });
    }

    // Metas em risco
    for (const m of metas) {
      const percentual = m.valor_objetivo > 0 ? Math.round((m.valor_atual / m.valor_objetivo) * 100) : 0;
      const diasPrazo = m.prazo ? Math.ceil((new Date(m.prazo).getTime() - Date.now()) / 86400000) : null;
      if (percentual < 80) {
        list.push({
          id: `meta-${m.titulo}`,
          tipo: "meta",
          titulo: `Meta "${m.titulo}" em risco`,
          descricao: `Progresso: ${percentual}% de ${m.valor_objetivo?.toLocaleString("pt-BR") ?? "—"}${diasPrazo !== null ? `. Faltam ${diasPrazo} dia${diasPrazo !== 1 ? "s" : ""} para o prazo.` : "."}`,
          acao: "Ver estratégias",
          prioridade: percentual < 50 ? "alta" : "media",
        });
      }
    }

    // Alertas de CNH
    for (const cnh of alertasCnh) {
      const vencida = cnh.situacao === "vencida";
      list.push({
        id: `cnh-${cnh.entregador_id || cnh.nome}`,
        tipo: "alerta",
        titulo: vencida ? `CNH vencida: ${cnh.nome}` : `CNH vence em breve: ${cnh.nome}`,
        descricao: vencida
          ? `A CNH de ${cnh.nome} está vencida desde ${cnh.validade_cnh ? new Date(cnh.validade_cnh).toLocaleDateString("pt-BR") : "data desconhecida"}. O entregador não pode dirigir legalmente.`
          : `A CNH de ${cnh.nome} vence em ${cnh.dias_ate_vencimento ?? "poucos"} dia(s). Providencie a renovação.`,
        acao: "Ver entregadores",
        prioridade: vencida ? "alta" : "media",
      });
    }

    // Conferência de caixa - divergências
    const caixaDivergente = conferenciaCaixa.filter((c: any) => c.diferenca_calculada && c.diferenca_calculada !== 0);
    if (caixaDivergente.length > 0) {
      const totalDif = caixaDivergente.reduce((s: number, c: any) => s + Math.abs(c.diferenca_calculada || 0), 0);
      list.push({
        id: "caixa-divergencia",
        tipo: "insight",
        titulo: `Divergência no caixa de hoje`,
        descricao: `Foram detectadas ${caixaDivergente.length} sessão(ões) com diferença total de R$ ${totalDif.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Verifique os lançamentos.`,
        acao: "Ver caixa do dia",
        prioridade: "alta",
        valor: `R$ ${totalDif.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });
    }

    return list;
  }, [rupturas, clientesInativos, contasVencendo, metas, alertasCnh, conferenciaCaixa]);

  const altaPrioridade = insights.filter(i => i.prioridade === "alta").length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["conselhos-rupturas"] });
    queryClient.invalidateQueries({ queryKey: ["conselhos-inativos"] });
    queryClient.invalidateQueries({ queryKey: ["conselhos-contas"] });
    queryClient.invalidateQueries({ queryKey: ["conselhos-metas"] });
    queryClient.invalidateQueries({ queryKey: ["conselhos-cnh"] });
    queryClient.invalidateQueries({ queryKey: ["conselhos-caixa"] });
  };

  return (
    <MainLayout>
      <Header title="Conselhos IA" subtitle="Insights em tempo real baseados nos seus dados" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={refresh} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar Análise
          </Button>
          <p className="text-xs text-muted-foreground">Atualizado agora • dados reais do sistema</p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10"><Sparkles className="h-6 w-6 text-primary" /></div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className="text-2xl font-bold">{insights.length}</p>}
                  <p className="text-sm text-muted-foreground">Insights</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={altaPrioridade > 0 ? "border-destructive/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className={`text-2xl font-bold ${altaPrioridade > 0 ? "text-destructive" : ""}`}>{altaPrioridade}</p>}
                  <p className="text-sm text-muted-foreground">Alta Prioridade</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10"><Users className="h-6 w-6 text-blue-500" /></div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className="text-2xl font-bold">{clientesInativos.length}</p>}
                  <p className="text-sm text-muted-foreground">Inativos (30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10"><Package className="h-6 w-6 text-orange-500" /></div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className="text-2xl font-bold">{rupturas.length}</p>}
                  <p className="text-sm text-muted-foreground">Estoque Risco</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-500/10"><ShieldAlert className="h-6 w-6 text-red-500" /></div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className="text-2xl font-bold">{alertasCnh.length}</p>}
                  <p className="text-sm text-muted-foreground">CNH em Risco</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10"><Banknote className="h-6 w-6 text-purple-500" /></div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className="text-2xl font-bold">{conferenciaCaixa.filter((c: any) => c.diferenca_calculada && c.diferenca_calculada !== 0).length}</p>}
                  <p className="text-sm text-muted-foreground">Caixa Divergente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="pt-6 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-32 mt-2" />
              </CardContent></Card>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Sparkles className="h-12 w-12 text-primary" />
              <p className="font-semibold text-lg">Tudo em ordem! 🎉</p>
              <p className="text-muted-foreground max-w-sm">
                Nenhum alerta crítico detectado agora. O estoque está confortável, os clientes ativos e as contas em dia.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {insights.map((insight) => {
              const config = iconConfig[insight.tipo];
              const Icon = config.icon;
              return (
                <Card key={insight.id} className={`hover:shadow-md transition-shadow ${insight.prioridade === "alta" ? "border-destructive/30" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bg} shrink-0 mt-0.5`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base leading-tight">{insight.titulo}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={insight.prioridade === "alta" ? "destructive" : insight.prioridade === "media" ? "default" : "secondary"}>
                            {insight.prioridade === "alta" ? "Alta Prioridade" : insight.prioridade === "media" ? "Média" : "Baixa"}
                          </Badge>
                          {insight.valor && (
                            <span className="text-xs font-semibold text-destructive">{insight.valor}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{insight.descricao}</p>
                    <Button variant="outline" size="sm">{insight.acao}</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
