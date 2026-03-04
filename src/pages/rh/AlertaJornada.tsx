import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Users, Shield, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function AlertaJornada() {
  const { unidadeAtual } = useUnidade();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-jornada", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("alertas_jornada")
        .select("*, funcionarios(nome)")
        .eq("resolvido", false)
        .order("data", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const alertasAltos = alertas.filter((a: any) => a.nivel === "alto").length;
  const alertasMedios = alertas.filter((a: any) => a.nivel === "medio").length;
  const funcionariosUnicos = new Set(alertas.map((a: any) => a.funcionario_id)).size;

  const tipoLabel: Record<string, string> = {
    horas_extras: "Horas Extras",
    intervalo: "Intervalo",
    descanso_semanal: "Descanso Semanal",
    jornada_noturna: "Jornada Noturna",
  };

  return (
    <MainLayout>
      <Header title="Alerta de Jornada" subtitle="Monitoramento de irregularidades" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Alertas</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertas.length}</div>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alta Prioridade</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{alertasAltos}</div>
              <p className="text-xs text-muted-foreground">Requer ação imediata</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Média Prioridade</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{alertasMedios}</div>
              <p className="text-xs text-muted-foreground">Monitorar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{funcionariosUnicos}</div>
              <p className="text-xs text-muted-foreground">Com alertas ativos</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              <CardTitle>Alertas de Jornada</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : alertas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum alerta ativo — tudo em conformidade! 🎉</p>
            ) : (
              <div className="space-y-4">
                {alertas.map((alerta: any) => (
                  <div key={alerta.id} className={`p-4 rounded-lg border-l-4 ${
                    alerta.nivel === "alto" ? "border-l-destructive bg-destructive/5" :
                    alerta.nivel === "medio" ? "border-l-warning bg-warning/5" :
                    "border-l-primary bg-primary/5"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`h-5 w-5 ${
                          alerta.nivel === "alto" ? "text-destructive" :
                          alerta.nivel === "medio" ? "text-warning" : "text-primary"
                        }`} />
                        <div>
                          <p className="font-medium">{alerta.funcionarios?.nome || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          alerta.nivel === "alto" ? "destructive" :
                          alerta.nivel === "medio" ? "secondary" : "outline"
                        }>
                          {tipoLabel[alerta.tipo] || alerta.tipo}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {parseLocalDate(alerta.data).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
