import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, TrendingUp, TrendingDown, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function BancoHoras() {
  const { unidadeAtual } = useUnidade();

  const { data: bancoHoras = [], isLoading } = useQuery({
    queryKey: ["banco-horas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("banco_horas")
        .select("*, funcionarios(nome)")
        .order("ultima_atualizacao", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const totalPositivo = bancoHoras.reduce((acc: number, b: any) => acc + Number(b.saldo_positivo), 0);
  const totalNegativo = bancoHoras.reduce((acc: number, b: any) => acc + Number(b.saldo_negativo), 0);

  return (
    <MainLayout>
      <Header title="Banco de Horas" subtitle="Controle de horas trabalhadas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button className="gap-2"><Clock className="h-4 w-4" />Lançar Horas</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPositivo - totalNegativo}h</div>
              <p className="text-xs text-muted-foreground">Equipe toda</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Horas Positivas</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{totalPositivo}h</div>
              <p className="text-xs text-muted-foreground">A compensar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Horas Negativas</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{totalNegativo}h</div>
              <p className="text-xs text-muted-foreground">A repor</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{bancoHoras.length}</div>
              <p className="text-xs text-muted-foreground">Com banco ativo</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Saldo por Funcionário</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : bancoHoras.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro no banco de horas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Horas Positivas</TableHead>
                    <TableHead>Horas Negativas</TableHead>
                    <TableHead>Saldo Total</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bancoHoras.map((registro: any) => {
                    const saldo = Number(registro.saldo_positivo) - Number(registro.saldo_negativo);
                    return (
                      <TableRow key={registro.id}>
                        <TableCell className="font-medium">{registro.funcionarios?.nome || "N/A"}</TableCell>
                        <TableCell className="text-success">+{Number(registro.saldo_positivo)}h</TableCell>
                        <TableCell className="text-destructive">-{Number(registro.saldo_negativo)}h</TableCell>
                        <TableCell>
                          <Badge variant={saldo >= 0 ? "default" : "destructive"}>
                            {saldo >= 0 ? "+" : ""}{saldo}h
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(registro.ultima_atualizacao).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Histórico</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
