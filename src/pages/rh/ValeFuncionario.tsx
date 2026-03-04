import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, Search, CheckCircle2, Clock, AlertCircle, Printer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { generateValeRecibo } from "@/services/receiptRhService";
import { NovoValeDialog } from "@/components/rh/NovoValeDialog";

export default function ValeFuncionario() {
  const [busca, setBusca] = useState("");
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_empresa").select("*").limit(1).single();
      return data;
    },
  });

  const { data: vales = [], isLoading } = useQuery({
    queryKey: ["vales-funcionario", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("vales_funcionario")
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
      const { error } = await supabase
        .from("vales_funcionario")
        .update({ status: "pago" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vales-funcionario"] });
      toast.success("Vale marcado como pago");
    },
  });

  const tipoLabel: Record<string, string> = {
    adiantamento: "Adiantamento",
    vale_alimentacao: "Vale Alimentação",
    vale_transporte: "Vale Transporte",
    emprestimo: "Empréstimo",
  };

  const handlePrintRecibo = (vale: any) => {
    if (!empresaConfig) {
      toast.error("Configure os dados da empresa primeiro");
      return;
    }
    generateValeRecibo({
      empresa: {
        nome_empresa: empresaConfig.nome_empresa,
        cnpj: empresaConfig.cnpj,
        telefone: empresaConfig.telefone,
        endereco: empresaConfig.endereco,
      },
      funcionario: vale.funcionarios?.nome || "N/A",
      tipo: tipoLabel[vale.tipo] || vale.tipo,
      valor: Number(vale.valor),
      data: parseLocalDate(vale.data).toLocaleDateString("pt-BR"),
      desconto_referencia: vale.desconto_referencia,
      observacoes: vale.observacoes,
    });
    toast.success("Recibo gerado!");
  };

  const filtrados = vales.filter((v: any) =>
    v.funcionarios?.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const totalPendente = filtrados.filter((v: any) => v.status === "pendente").reduce((acc: number, v: any) => acc + Number(v.valor), 0);
  const totalPago = filtrados.filter((v: any) => v.status === "pago").reduce((acc: number, v: any) => acc + Number(v.valor), 0);
  const totalMes = totalPendente + totalPago;

  return (
    <MainLayout>
      <Header title="Vale Funcionário" subtitle="Controle de adiantamentos e vales" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <NovoValeDialog />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalMes.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Em vales liberados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">R$ {totalPendente.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pagos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">R$ {totalPago.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Já liberados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A Descontar</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">R$ {totalPendente.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Na próxima folha</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Vales e Adiantamentos</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar funcionário..."
                  className="pl-10 w-[250px]"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtrados.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum vale encontrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((vale: any) => (
                    <TableRow key={vale.id}>
                      <TableCell className="font-medium">{vale.funcionarios?.nome || "N/A"}</TableCell>
                      <TableCell><Badge variant="outline">{tipoLabel[vale.tipo] || vale.tipo}</Badge></TableCell>
                      <TableCell>{parseLocalDate(vale.data).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-medium">R$ {Number(vale.valor).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{vale.desconto_referencia || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={
                          vale.status === "pago" ? "default" :
                          vale.status === "pendente" ? "secondary" : "outline"
                        }>
                          {vale.status === "pago" ? "Pago" : vale.status === "pendente" ? "Pendente" : "Parcelado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => handlePrintRecibo(vale)}>
                            <Printer className="h-3 w-3" />
                          </Button>
                          {vale.status === "pendente" && (
                            <Button size="sm" onClick={() => pagarMutation.mutate(vale.id)}>Pagar</Button>
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
