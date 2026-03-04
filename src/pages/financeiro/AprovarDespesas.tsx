import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format } from "date-fns";

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: string | null;
  solicitante: string | null;
  responsavel: string | null;
  urgencia: string | null;
  status: string;
  created_at: string;
}

export default function AprovarDespesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const { unidadeAtual } = useUnidade();

  const fetchDespesas = async () => {
    setLoading(true);
    let query = supabase.from("movimentacoes_caixa").select("*").eq("tipo", "saida").order("created_at", { ascending: false }).limit(50);
    if (unidadeAtual?.id) query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data, error } = await query;
    if (error) console.error(error);
    else setDespesas((data as Despesa[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDespesas(); }, [unidadeAtual]);

  const handleStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("movimentacoes_caixa").update({ status }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); console.error(error); }
    else { toast.success(status === "aprovada" ? "Despesa aprovada!" : "Despesa rejeitada!"); fetchDespesas(); }
  };

  const pendentes = despesas.filter(d => d.status === "pendente");
  const totalPendente = pendentes.reduce((a, d) => a + Number(d.valor), 0);
  const totalAprovado = despesas.filter(d => d.status === "aprovada").reduce((a, d) => a + Number(d.valor), 0);
  const totalRejeitado = despesas.filter(d => d.status === "rejeitada").reduce((a, d) => a + Number(d.valor), 0);

  return (
    <MainLayout>
      <Header title="Aprovar Despesas" subtitle="Analise e aprove solicitações de despesas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pendentes</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold text-warning">{pendentes.length}</div><p className="text-xs text-muted-foreground">Aguardando aprovação</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Valor Pendente</CardTitle><AlertTriangle className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold text-warning">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Aprovadas</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">R$ {totalAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Rejeitadas</CardTitle><XCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">R$ {totalRejeitado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Solicitações de Despesa</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-center py-8 text-muted-foreground">Carregando...</p> : despesas.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhuma despesa encontrada</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Solicitante</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Data</TableHead><TableHead>Urgência</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {despesas.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.solicitante || d.responsavel || "—"}</TableCell>
                      <TableCell>{d.descricao}</TableCell>
                      <TableCell><Badge variant="outline">{d.categoria || "—"}</Badge></TableCell>
                      <TableCell>{format(new Date(d.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell><Badge variant={d.urgencia === "alta" ? "destructive" : d.urgencia === "media" ? "secondary" : "outline"}>{d.urgencia || "normal"}</Badge></TableCell>
                      <TableCell className="font-medium">R$ {Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={d.status === "aprovada" ? "default" : d.status === "rejeitada" ? "destructive" : "secondary"}>{d.status === "aprovada" ? "Aprovada" : d.status === "rejeitada" ? "Rejeitada" : "Pendente"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {d.status === "pendente" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleStatus(d.id, "aprovada")} className="gap-1"><CheckCircle className="h-3 w-3" />Aprovar</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleStatus(d.id, "rejeitada")} className="gap-1"><XCircle className="h-3 w-3" />Rejeitar</Button>
                          </div>
                        )}
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
