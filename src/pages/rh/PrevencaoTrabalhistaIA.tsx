import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Shield, AlertTriangle, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrevencaoTrabalhistaIA() {
  const { unidadeAtual } = useUnidade();

  // Buscar alertas de jornada ativos
  const { data: alertas = [], isLoading: loadingAlertas } = useQuery({
    queryKey: ["prevencao-alertas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("alertas_jornada")
        .select("*, funcionarios(nome, cargo)")
        .eq("resolvido", false)
        .order("data", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar banco de horas com saldo negativo alto
  const { data: bancoHorasRisco = [] } = useQuery({
    queryKey: ["prevencao-banco-horas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("banco_horas")
        .select("*, funcionarios(nome, cargo)")
        .gt("saldo_negativo", 10);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar funcionários sem horário definido
  const { data: semHorario = [] } = useQuery({
    queryKey: ["prevencao-sem-horario", unidadeAtual?.id],
    queryFn: async () => {
      let funcQuery = supabase.from("funcionarios").select("id, nome, cargo").eq("ativo", true);
      if (unidadeAtual?.id) funcQuery = funcQuery.eq("unidade_id", unidadeAtual.id);
      const { data: funcs } = await funcQuery;

      let horQuery = supabase.from("horarios_funcionario").select("funcionario_id");
      if (unidadeAtual?.id) horQuery = horQuery.eq("unidade_id", unidadeAtual.id);
      const { data: horarios } = await horQuery;

      const comHorario = new Set((horarios || []).map((h: any) => h.funcionario_id));
      return (funcs || []).filter((f: any) => !comHorario.has(f.id));
    },
  });

  const isLoading = loadingAlertas;

  // Montar análises a partir dos dados reais
  const analises: {
    id: string;
    titulo: string;
    descricao: string;
    risco: "Alto" | "Médio" | "Baixo";
    recomendacao: string;
    funcionarios: string[];
  }[] = [];

  // Alertas de horas extras
  const alertasHorasExtras = alertas.filter((a: any) => a.tipo === "horas_extras");
  if (alertasHorasExtras.length > 0) {
    analises.push({
      id: "horas_extras",
      titulo: "Risco de Horas Extras Excessivas",
      descricao: `${alertasHorasExtras.length} alerta(s) de horas extras registrados. Risco de processo trabalhista por excesso de jornada.`,
      risco: "Alto",
      recomendacao: "Redistribuir carga de trabalho e contratar temporário para período de pico.",
      funcionarios: alertasHorasExtras.map((a: any) => a.funcionarios?.nome || "N/A"),
    });
  }

  // Alertas de intervalo
  const alertasIntervalo = alertas.filter((a: any) => a.tipo === "intervalo");
  if (alertasIntervalo.length > 0) {
    analises.push({
      id: "intervalo",
      titulo: "Intervalos Não Cumpridos",
      descricao: `${alertasIntervalo.length} registro(s) de intervalos irregulares no setor operacional.`,
      risco: "Médio",
      recomendacao: "Implementar sistema de alerta para garantir cumprimento do intervalo mínimo.",
      funcionarios: alertasIntervalo.map((a: any) => a.funcionarios?.nome || "N/A"),
    });
  }

  // Alertas de descanso semanal
  const alertasDescanso = alertas.filter((a: any) => a.tipo === "descanso_semanal");
  if (alertasDescanso.length > 0) {
    analises.push({
      id: "descanso",
      titulo: "Descanso Semanal Remunerado Irregular",
      descricao: `${alertasDescanso.length} funcionário(s) sem descanso semanal adequado.`,
      risco: "Alto",
      recomendacao: "Garantir folga semanal obrigatória. O DSR não concedido gera pagamento em dobro.",
      funcionarios: alertasDescanso.map((a: any) => a.funcionarios?.nome || "N/A"),
    });
  }

  // Banco de horas negativo
  if (bancoHorasRisco.length > 0) {
    analises.push({
      id: "banco_horas_negativo",
      titulo: "Banco de Horas com Saldo Negativo Elevado",
      descricao: `${bancoHorasRisco.length} funcionário(s) com mais de 10h negativas no banco de horas.`,
      risco: "Médio",
      recomendacao: "Regularizar saldo negativo antes do fechamento do mês para evitar desconto em folha.",
      funcionarios: bancoHorasRisco.map((b: any) => b.funcionarios?.nome || "N/A"),
    });
  }

  // Funcionários sem horário definido
  if (semHorario.length > 0) {
    analises.push({
      id: "sem_horario",
      titulo: "Funcionários Sem Horário Definido",
      descricao: `${semHorario.length} funcionário(s) sem jornada de trabalho registrada no sistema.`,
      risco: "Médio",
      recomendacao: "Definir horários para todos os funcionários ativos. A falta de registro pode gerar passivo trabalhista.",
      funcionarios: semHorario.map((f: any) => f.nome),
    });
  }

  // Se não houver nenhum problema, mostrar tudo ok
  if (analises.length === 0 && !isLoading) {
    analises.push({
      id: "tudo_ok",
      titulo: "Tudo em Conformidade",
      descricao: "Nenhum risco trabalhista identificado no momento. Continue monitorando.",
      risco: "Baixo",
      recomendacao: "Manter a rotina de monitoramento e atualização dos registros de ponto e jornada.",
      funcionarios: [],
    });
  }

  const riscoAlto = analises.filter((a) => a.risco === "Alto").length;
  const riscoMedio = analises.filter((a) => a.risco === "Médio").length;

  return (
    <MainLayout>
      <Header title="Prevenção Trabalhista - IA" subtitle="Análise inteligente de riscos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="gap-1">
            <Brain className="h-3 w-3" />
            Análise baseada em dados reais
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Análises Ativas</CardTitle>
              <Brain className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analises.length}</div>
              <p className="text-xs text-muted-foreground">Pontos identificados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Risco Alto</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{riscoAlto}</div>
              <p className="text-xs text-muted-foreground">Ação imediata</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Risco Médio</CardTitle>
              <Shield className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{riscoMedio}</div>
              <p className="text-xs text-muted-foreground">Monitorar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertas.length}</div>
              <p className="text-xs text-muted-foreground">No período</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : (
          <div className="space-y-4">
            {analises.map((analise) => (
              <Card
                key={analise.id}
                className={`border-l-4 ${
                  analise.risco === "Alto"
                    ? "border-l-destructive"
                    : analise.risco === "Médio"
                    ? "border-l-warning"
                    : "border-l-primary"
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {analise.risco === "Alto" ? (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      ) : analise.risco === "Médio" ? (
                        <Shield className="h-5 w-5 text-warning" />
                      ) : (
                        <Brain className="h-5 w-5 text-primary" />
                      )}
                      <CardTitle className="text-lg">{analise.titulo}</CardTitle>
                    </div>
                    <Badge
                      variant={
                        analise.risco === "Alto" ? "destructive" : analise.risco === "Médio" ? "secondary" : "outline"
                      }
                    >
                      Risco {analise.risco}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{analise.descricao}</p>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-primary">Recomendação</p>
                        <p className="text-sm text-muted-foreground">{analise.recomendacao}</p>
                      </div>
                    </div>
                  </div>

                  {analise.funcionarios.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">Funcionários envolvidos:</span>
                      {analise.funcionarios.map((func, index) => (
                        <Badge key={index} variant="outline">
                          {func}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
