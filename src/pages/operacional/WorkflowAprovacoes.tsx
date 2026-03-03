import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Shield, Plus, Loader2, Settings2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function WorkflowAprovacoes() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pendentes");
  const [alcadaDialog, setAlcadaDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectObs, setRejectObs] = useState("");
  const [newAlcada, setNewAlcada] = useState({ tipo: "despesa", nivel: 1, valor_minimo: 0, valor_maximo: 0, cargo_aprovador: "gestor" });

  const { data: aprovacoes = [], isLoading } = useQuery({
    queryKey: ["aprovacoes", empresa?.id, tab],
    enabled: !!empresa?.id,
    queryFn: async () => {
      let q = supabase.from("aprovacoes").select("*").eq("empresa_id", empresa!.id);
      if (tab === "pendentes") q = q.eq("status", "pendente");
      else if (tab === "aprovados") q = q.eq("status", "aprovado");
      else if (tab === "rejeitados") q = q.eq("status", "rejeitado");
      q = q.order("created_at", { ascending: false });
      const { data } = await q;
      return data || [];
    },
  });

  const { data: alcadas = [] } = useQuery({
    queryKey: ["alcadas", empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const { data } = await supabase.from("alcadas_aprovacao").select("*").eq("empresa_id", empresa!.id).order("tipo").order("nivel");
      return data || [];
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aprovacoes").update({ status: "aprovado", data_decisao: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["aprovacoes"] }); toast.success("Aprovado!"); },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async ({ id, obs }: { id: string; obs: string }) => {
      const { error } = await supabase.from("aprovacoes").update({ status: "rejeitado", observacoes: obs, data_decisao: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["aprovacoes"] }); setRejectDialog(null); setRejectObs(""); toast.success("Rejeitado."); },
  });

  const salvarAlcada = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("alcadas_aprovacao").insert({
        empresa_id: empresa!.id,
        unidade_id: unidadeAtual?.id || null,
        ...newAlcada,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alcadas"] }); setAlcadaDialog(false); toast.success("Alçada cadastrada!"); },
  });

  const pendentes = aprovacoes.filter((a: any) => a.status === "pendente").length;

  const tipoLabel: Record<string, string> = { despesa: "Despesa", compra: "Compra", desconto: "Desconto", cancelamento: "Cancelamento" };
  const cargoLabel: Record<string, string> = { operador: "Operador", gestor: "Gestor", diretor: "Diretor" };

  return (
    <MainLayout>
      <Header title="Workflow de Aprovações" subtitle="Fluxo multinível inspirado no SAP" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-chart-4">{pendentes}</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-green-600">{aprovacoes.filter((a: any) => a.status === "aprovado").length}</p><p className="text-xs text-muted-foreground">Aprovados</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-destructive">{aprovacoes.filter((a: any) => a.status === "rejeitado").length}</p><p className="text-xs text-muted-foreground">Rejeitados</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-primary">{alcadas.length}</p><p className="text-xs text-muted-foreground">Alçadas</p></CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="pendentes" className="gap-1.5"><Clock className="h-4 w-4" />Pendentes</TabsTrigger>
              <TabsTrigger value="aprovados" className="gap-1.5"><CheckCircle className="h-4 w-4" />Aprovados</TabsTrigger>
              <TabsTrigger value="rejeitados" className="gap-1.5"><XCircle className="h-4 w-4" />Rejeitados</TabsTrigger>
              <TabsTrigger value="alcadas" className="gap-1.5"><Shield className="h-4 w-4" />Alçadas</TabsTrigger>
            </TabsList>
            {tab === "alcadas" && (
              <Button size="sm" onClick={() => setAlcadaDialog(true)}><Plus className="h-4 w-4 mr-1" />Nova Alçada</Button>
            )}
          </div>

          <TabsContent value="pendentes">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Nível</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {aprovacoes.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma aprovação pendente 🎉</TableCell></TableRow>
                      ) : aprovacoes.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell><Badge variant="outline">{tipoLabel[a.tipo] || a.tipo}</Badge></TableCell>
                          <TableCell className="max-w-[200px] truncate">{a.descricao}</TableCell>
                          <TableCell>R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell><Badge>{a.nivel_atual}</Badge></TableCell>
                          <TableCell className="text-sm">{format(new Date(a.created_at), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="sm" variant="default" onClick={() => aprovarMutation.mutate(a.id)}><CheckCircle className="h-4 w-4 mr-1" />Aprovar</Button>
                            <Button size="sm" variant="destructive" onClick={() => setRejectDialog(a.id)}><XCircle className="h-4 w-4 mr-1" />Rejeitar</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="aprovados">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Decisão</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aprovacoes.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="outline">{tipoLabel[a.tipo] || a.tipo}</Badge></TableCell>
                      <TableCell>{a.descricao}</TableCell>
                      <TableCell>R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{a.data_decisao ? format(new Date(a.data_decisao), "dd/MM/yy HH:mm") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="rejeitados">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aprovacoes.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="destructive">{tipoLabel[a.tipo] || a.tipo}</Badge></TableCell>
                      <TableCell>{a.descricao}</TableCell>
                      <TableCell>R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.observacoes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="alcadas">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Nível</TableHead><TableHead>Faixa de Valor</TableHead><TableHead>Aprovador</TableHead></TableRow></TableHeader>
                <TableBody>
                  {alcadas.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma alçada configurada. Clique em "Nova Alçada".</TableCell></TableRow>
                  ) : alcadas.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="outline">{tipoLabel[a.tipo] || a.tipo}</Badge></TableCell>
                      <TableCell>{a.nivel}</TableCell>
                      <TableCell>R$ {Number(a.valor_minimo).toLocaleString("pt-BR")} até {a.valor_maximo ? `R$ ${Number(a.valor_maximo).toLocaleString("pt-BR")}` : "∞"}</TableCell>
                      <TableCell>{cargoLabel[a.cargo_aprovador] || a.cargo_aprovador}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
          <DialogContent><DialogHeader><DialogTitle>Rejeitar Solicitação</DialogTitle><DialogDescription>Informe o motivo da rejeição.</DialogDescription></DialogHeader>
            <Textarea value={rejectObs} onChange={(e) => setRejectObs(e.target.value)} placeholder="Motivo da rejeição..." />
            <Button variant="destructive" className="w-full" onClick={() => rejectDialog && rejeitarMutation.mutate({ id: rejectDialog, obs: rejectObs })}>Confirmar Rejeição</Button>
          </DialogContent>
        </Dialog>

        {/* Alçada Dialog */}
        <Dialog open={alcadaDialog} onOpenChange={setAlcadaDialog}>
          <DialogContent><DialogHeader><DialogTitle>Nova Alçada de Aprovação</DialogTitle><DialogDescription>Configure os limites por tipo e cargo.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tipo</Label>
                <Select value={newAlcada.tipo} onValueChange={(v) => setNewAlcada(p => ({ ...p, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="despesa">Despesa</SelectItem><SelectItem value="compra">Compra</SelectItem><SelectItem value="desconto">Desconto</SelectItem><SelectItem value="cancelamento">Cancelamento</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nível</Label><Input type="number" value={newAlcada.nivel} onChange={(e) => setNewAlcada(p => ({ ...p, nivel: Number(e.target.value) }))} /></div>
                <div><Label>Cargo Aprovador</Label>
                  <Select value={newAlcada.cargo_aprovador} onValueChange={(v) => setNewAlcada(p => ({ ...p, cargo_aprovador: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="operador">Operador</SelectItem><SelectItem value="gestor">Gestor</SelectItem><SelectItem value="diretor">Diretor</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor Mínimo (R$)</Label><Input type="number" value={newAlcada.valor_minimo} onChange={(e) => setNewAlcada(p => ({ ...p, valor_minimo: Number(e.target.value) }))} /></div>
                <div><Label>Valor Máximo (R$)</Label><Input type="number" value={newAlcada.valor_maximo} onChange={(e) => setNewAlcada(p => ({ ...p, valor_maximo: Number(e.target.value) }))} placeholder="Deixe 0 = ilimitado" /></div>
              </div>
              <Button className="w-full" onClick={() => salvarAlcada.mutate()}>Salvar Alçada</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
