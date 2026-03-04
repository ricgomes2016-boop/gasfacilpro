import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Gift, Plus, DollarSign, Users, Target, Printer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { generateBonusRecibo } from "@/services/receiptRhService";

const tipoLabel: Record<string, string> = {
  meta_vendas: "Meta Vendas",
  indicacao: "Indicação Cliente",
  aniversario: "Aniversário Empresa",
  pontualidade: "Pontualidade",
};

export default function Bonus() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_empresa").select("*").limit(1).single();
      return data;
    },
  });

  const { data: bonusList = [], isLoading } = useQuery({
    queryKey: ["bonus", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("bonus")
        .select("*, funcionarios(nome)")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const pagarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bonus").update({ status: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonus"] });
      toast.success("Bônus marcado como pago");
    },
  });

  const handlePrintRecibo = (bonus: any) => {
    if (!empresaConfig) {
      toast.error("Configure os dados da empresa primeiro");
      return;
    }
    generateBonusRecibo({
      empresa: {
        nome_empresa: empresaConfig.nome_empresa,
        cnpj: empresaConfig.cnpj,
        telefone: empresaConfig.telefone,
        endereco: empresaConfig.endereco,
      },
      funcionario: bonus.funcionarios?.nome || "N/A",
      tipo: tipoLabel[bonus.tipo] || bonus.tipo,
      valor: Number(bonus.valor),
      mesReferencia: bonus.mes_referencia || "-",
      observacoes: bonus.observacoes,
    });
    toast.success("Recibo gerado!");
  };

  const totalPago = bonusList.filter((b: any) => b.status === "pago").reduce((acc: number, b: any) => acc + Number(b.valor), 0);
  const totalPendente = bonusList.filter((b: any) => b.status === "pendente").reduce((acc: number, b: any) => acc + Number(b.valor), 0);

  return (
    <MainLayout>
      <Header title="Bônus" subtitle="Gestão de bonificações extras" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button className="gap-2"><Plus className="h-4 w-4" />Novo Bônus</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Bônus (Mês)</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {(totalPago + totalPendente).toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pagos</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">R$ {totalPago.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Target className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">R$ {totalPendente.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Beneficiados</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{bonusList.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Lista de Bônus</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : bonusList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum bônus cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonusList.map((bonus: any) => (
                    <TableRow key={bonus.id}>
                      <TableCell className="font-medium">{bonus.funcionarios?.nome || "N/A"}</TableCell>
                      <TableCell><Badge variant="outline">{tipoLabel[bonus.tipo] || bonus.tipo}</Badge></TableCell>
                      <TableCell>{bonus.mes_referencia || "-"}</TableCell>
                      <TableCell className="font-medium">R$ {Number(bonus.valor).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant={bonus.status === "pago" ? "default" : "secondary"}>
                          {bonus.status === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => handlePrintRecibo(bonus)}>
                            <Printer className="h-3 w-3" />
                          </Button>
                          {bonus.status === "pendente" && (
                            <Button size="sm" onClick={() => pagarMutation.mutate(bonus.id)}>Pagar</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
