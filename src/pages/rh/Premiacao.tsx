import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Gift, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function Premiacao() {
  const { data: premiacoes = [], isLoading } = useQuery({
    queryKey: ["premiacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premiacoes")
        .select("*, funcionarios:ganhador_id(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const atingidas = premiacoes.filter((p: any) => p.status === "atingida").length;
  const totalPremios = premiacoes.filter((p: any) => p.status === "atingida" && p.premio)
    .reduce((acc: number, p: any) => {
      const match = p.premio?.match(/R\$\s*([\d.,]+)/);
      return acc + (match ? parseFloat(match[1].replace(".", "").replace(",", ".")) : 0);
    }, 0);

  return (
    <MainLayout>
      <Header title="Premiações" subtitle="Incentivos e reconhecimento da equipe" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button className="gap-2"><Gift className="h-4 w-4" />Nova Premiação</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Premiações Ativas</CardTitle>
              <Trophy className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{premiacoes.length}</div>
              <p className="text-xs text-muted-foreground">Este mês</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Metas Atingidas</CardTitle>
              <Target className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{atingidas}</div>
              <p className="text-xs text-muted-foreground">De {premiacoes.length} totais</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total em Prêmios</CardTitle>
              <Gift className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">R$ {totalPremios.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Distribuídos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Funcionários Premiados</CardTitle>
              <Crown className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{premiacoes.filter((p: any) => p.ganhador_id).length}</div>
              <p className="text-xs text-muted-foreground">Este mês</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : premiacoes.length === 0 ? (
          <Card><CardContent className="py-8"><p className="text-center text-muted-foreground">Nenhuma premiação cadastrada</p></CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                <CardTitle>Premiações do Mês</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {premiacoes.map((premiacao: any) => (
                <div key={premiacao.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{premiacao.nome}</h3>
                    <Badge variant={premiacao.status === "atingida" ? "default" : "secondary"}>
                      {premiacao.status === "atingida" ? "Atingida" : premiacao.status === "encerrada" ? "Encerrada" : "Em andamento"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{premiacao.meta_descricao}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">{premiacao.premio}</span>
                    {premiacao.funcionarios?.nome && (
                      <div className="flex items-center gap-1 text-sm">
                        <Crown className="h-3 w-3 text-warning" />
                        {premiacao.funcionarios.nome}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
