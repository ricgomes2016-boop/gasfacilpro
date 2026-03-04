import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, Users, Target, Zap, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";

export default function ProdutividadeIA() {
  const { unidadeAtual } = useUnidade();
  const now = new Date();
  const mesInicio = startOfMonth(now).toISOString();
  const mesFim = endOfMonth(now).toISOString();

  // Buscar pedidos entregues do mês por entregador
  const { data: pedidosMes = [], isLoading } = useQuery({
    queryKey: ["produtividade-pedidos", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select("id, entregador_id, created_at, entregadores(nome)")
        .eq("status", "entregue")
        .not("entregador_id", "is", null)
        .gte("created_at", mesInicio)
        .lte("created_at", mesFim);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar metas ativas
  const { data: metas = [] } = useQuery({
    queryKey: ["produtividade-metas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("metas")
        .select("*")
        .eq("status", "ativa")
        .eq("tipo", "entregas");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const metaGlobal = metas.length > 0 ? Number(metas[0].valor_objetivo) : 200;

  // Agrupar por entregador
  const produtividadeEquipe = useMemo(() => {
    const porEntregador = new Map<string, { nome: string; entregas: number }>();
    pedidosMes.forEach((p: any) => {
      const id = p.entregador_id;
      const existing = porEntregador.get(id) || { nome: p.entregadores?.nome || "N/A", entregas: 0 };
      existing.entregas += 1;
      porEntregador.set(id, existing);
    });
    return Array.from(porEntregador.values())
      .map((e) => ({
        ...e,
        meta: metaGlobal,
        produtividade: Math.min(Math.round((e.entregas / metaGlobal) * 100), 100),
      }))
      .sort((a, b) => b.produtividade - a.produtividade);
  }, [pedidosMes, metaGlobal]);

  // Entregas por dia da semana (últimos 7 dias)
  const produtividadeSemanal = useMemo(() => {
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const contagem = Array(7).fill(0);
    pedidosMes.forEach((p: any) => {
      const dia = new Date(p.created_at).getDay();
      contagem[dia] += 1;
    });
    return dias.map((dia, i) => ({ dia, entregas: contagem[i] }));
  }, [pedidosMes]);

  const mediaProdutividade = produtividadeEquipe.length > 0
    ? Math.round(produtividadeEquipe.reduce((acc, p) => acc + p.produtividade, 0) / produtividadeEquipe.length)
    : 0;
  const acimaMeta = produtividadeEquipe.filter((p) => p.produtividade >= 100).length;
  const precisamAtencao = produtividadeEquipe.filter((p) => p.produtividade < 80).length;

  // Insights dinâmicos
  const insights = useMemo(() => {
    const result: { id: number; tipo: string; mensagem: string; icone: string }[] = [];
    const melhor = produtividadeEquipe[0];
    if (melhor && melhor.produtividade >= 100) {
      result.push({
        id: 1,
        tipo: "Positivo",
        mensagem: `${melhor.nome} superou a meta com ${melhor.entregas} entregas (${melhor.produtividade}%). Considere reconhecimento.`,
        icone: "🏆",
      });
    }
    const pior = produtividadeEquipe[produtividadeEquipe.length - 1];
    if (pior && pior.produtividade < 80 && produtividadeEquipe.length > 1) {
      result.push({
        id: 2,
        tipo: "Atenção",
        mensagem: `${pior.nome} está com ${pior.produtividade}% da meta. Verifique necessidade de suporte ou treinamento.`,
        icone: "📉",
      });
    }
    const melhorDia = produtividadeSemanal.reduce((a, b) => (a.entregas > b.entregas ? a : b));
    if (melhorDia.entregas > 0) {
      result.push({
        id: 3,
        tipo: "Oportunidade",
        mensagem: `${melhorDia.dia} é o dia mais produtivo com ${melhorDia.entregas} entregas no mês. Otimize as rotas nesses dias.`,
        icone: "💡",
      });
    }
    if (result.length === 0) {
      result.push({
        id: 4,
        tipo: "Positivo",
        mensagem: "Dados insuficientes para gerar insights. Continue registrando entregas para análise.",
        icone: "📊",
      });
    }
    return result;
  }, [produtividadeEquipe, produtividadeSemanal]);

  return (
    <MainLayout>
      <Header title="Produtividade - IA" subtitle="Análise inteligente de desempenho" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="gap-1">
            <Brain className="h-3 w-3" />
            Dados em tempo real
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Produtividade Média</CardTitle>
              <Zap className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mediaProdutividade}%</div>
              <p className="text-xs text-muted-foreground">Da equipe</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Acima da Meta</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{acimaMeta}</div>
              <p className="text-xs text-muted-foreground">Entregadores</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Precisam Atenção</CardTitle>
              <Target className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{precisamAtencao}</div>
              <p className="text-xs text-muted-foreground">Abaixo de 80%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Entregas</CardTitle>
              <Brain className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{pedidosMes.length}</div>
              <p className="text-xs text-muted-foreground">No mês</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Entregas por Dia da Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={produtividadeSemanal}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="entregas" fill="hsl(var(--primary))" name="Entregas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle>Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-3 rounded-lg ${
                      insight.tipo === "Positivo"
                        ? "bg-primary/5"
                        : insight.tipo === "Atenção"
                        ? "bg-warning/10"
                        : "bg-accent/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{insight.icone}</span>
                      <p className="text-sm">{insight.mensagem}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Desempenho Individual (Meta: {metaGlobal} entregas/mês)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : produtividadeEquipe.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma entrega registrada no mês</p>
            ) : (
              produtividadeEquipe.map((funcionario) => (
                <div key={funcionario.nome} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{funcionario.nome}</span>
                      {funcionario.produtividade >= 100 && <Award className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {funcionario.entregas}/{funcionario.meta} entregas
                      </span>
                      <Badge variant={funcionario.produtividade >= 80 ? "default" : "secondary"}>
                        {funcionario.produtividade}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={funcionario.produtividade} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
