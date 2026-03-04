import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, LogIn, LogOut, Coffee, Play, Plus, Users, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { getBrasiliaDateString } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { useState } from "react";

export default function PontoEletronico() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [dataSelecionada, setDataSelecionada] = useState(getBrasiliaDateString());
  const [showNovo, setShowNovo] = useState(false);
  const [novoFuncId, setNovoFuncId] = useState("");
  const [showEditar, setShowEditar] = useState(false);
  const [pontoEditando, setPontoEditando] = useState<any>(null);
  const [editForm, setEditForm] = useState({ entrada: "", saida_almoco: "", retorno_almoco: "", saida: "" });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["ponto-funcionarios", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: pontos = [], isLoading } = useQuery({
    queryKey: ["ponto-eletronico", dataSelecionada, unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("ponto_eletronico")
        .select("*, funcionarios(nome)")
        .eq("data", dataSelecionada)
        .order("created_at");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const registrarPonto = useMutation({
    mutationFn: async ({ pontoId, campo }: { pontoId?: string; campo: string; funcId?: string }) => {
      const agora = new Date().toISOString();
      if (pontoId) {
        const updateData: any = { [campo]: agora };
        if (campo === "saida") updateData.status = "fechado";
        const { error } = await supabase.from("ponto_eletronico").update(updateData).eq("id", pontoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ponto_eletronico").insert({
          funcionario_id: novoFuncId,
          data: dataSelecionada,
          entrada: agora,
          unidade_id: unidadeAtual?.id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Ponto registrado!");
      queryClient.invalidateQueries({ queryKey: ["ponto-eletronico"] });
      setShowNovo(false);
      setNovoFuncId("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editarPonto = useMutation({
    mutationFn: async () => {
      if (!pontoEditando) return;
      const baseDate = pontoEditando.data;
      const toISO = (time: string) => {
        if (!time) return null;
        return new Date(`${baseDate}T${time}:00`).toISOString();
      };
      const updateData: any = {
        entrada: editForm.entrada ? toISO(editForm.entrada) : null,
        saida_almoco: editForm.saida_almoco ? toISO(editForm.saida_almoco) : null,
        retorno_almoco: editForm.retorno_almoco ? toISO(editForm.retorno_almoco) : null,
        saida: editForm.saida ? toISO(editForm.saida) : null,
      };
      updateData.status = editForm.saida ? "fechado" : "aberto";
      const { error } = await supabase.from("ponto_eletronico").update(updateData).eq("id", pontoEditando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ponto atualizado!");
      queryClient.invalidateQueries({ queryKey: ["ponto-eletronico"] });
      setShowEditar(false);
      setPontoEditando(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const abrirEdicao = (ponto: any) => {
    setPontoEditando(ponto);
    const toTime = (ts: string | null) => ts ? format(new Date(ts), "HH:mm") : "";
    setEditForm({
      entrada: toTime(ponto.entrada),
      saida_almoco: toTime(ponto.saida_almoco),
      retorno_almoco: toTime(ponto.retorno_almoco),
      saida: toTime(ponto.saida),
    });
    setShowEditar(true);
  };

  const fmtHora = (ts: string | null) => ts ? format(new Date(ts), "HH:mm") : "—";

  const calcHoras = (ponto: any) => {
    if (!ponto.entrada || !ponto.saida) return "—";
    const entrada = new Date(ponto.entrada).getTime();
    const saida = new Date(ponto.saida).getTime();
    const almoco = (ponto.saida_almoco && ponto.retorno_almoco)
      ? (new Date(ponto.retorno_almoco).getTime() - new Date(ponto.saida_almoco).getTime()) : 0;
    const totalMs = saida - entrada - almoco;
    const hours = Math.floor(totalMs / 3600000);
    const mins = Math.floor((totalMs % 3600000) / 60000);
    return `${hours}h${String(mins).padStart(2, "0")}`;
  };

  const statusBadge = (status: string) => {
    if (status === "fechado") return <Badge variant="secondary">Fechado</Badge>;
    return <Badge>Aberto</Badge>;
  };

  const pontosAbertos = pontos.filter((p: any) => p.status === "aberto").length;
  const pontosFechados = pontos.filter((p: any) => p.status === "fechado").length;

  return (
    <MainLayout>
      <Header title="Ponto Eletrônico" subtitle="Registro de entrada e saída dos funcionários" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Input
            type="date"
            value={dataSelecionada}
            onChange={e => setDataSelecionada(e.target.value)}
            className="w-48"
          />
          <Button className="gap-2" onClick={() => setShowNovo(true)}>
            <Plus className="h-4 w-4" />Registrar Entrada
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pontos.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Expediente</CardTitle>
              <Play className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{pontosAbertos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Finalizados</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pontosFechados}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registros de {format(new Date(dataSelecionada + "T12:00:00"), "dd/MM/yyyy")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : pontos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro para esta data</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center">Entrada</TableHead>
                    <TableHead className="text-center">Saída Almoço</TableHead>
                    <TableHead className="text-center">Retorno</TableHead>
                    <TableHead className="text-center">Saída</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pontos.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{(p as any).funcionarios?.nome || "—"}</TableCell>
                      <TableCell className="text-center">{fmtHora(p.entrada)}</TableCell>
                      <TableCell className="text-center">{fmtHora(p.saida_almoco)}</TableCell>
                      <TableCell className="text-center">{fmtHora(p.retorno_almoco)}</TableCell>
                      <TableCell className="text-center">{fmtHora(p.saida)}</TableCell>
                      <TableCell className="text-center font-medium">{calcHoras(p)}</TableCell>
                      <TableCell className="text-center">{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => abrirEdicao(p)}>
                            <Pencil className="h-3 w-3" />Editar
                          </Button>
                          {p.status === "aberto" && (
                            <>
                              {!p.saida_almoco && (
                                <Button size="sm" variant="outline" className="gap-1 text-xs"
                                  onClick={() => registrarPonto.mutate({ pontoId: p.id, campo: "saida_almoco" })}>
                                  <Coffee className="h-3 w-3" />Almoço
                                </Button>
                              )}
                              {p.saida_almoco && !p.retorno_almoco && (
                                <Button size="sm" variant="outline" className="gap-1 text-xs"
                                  onClick={() => registrarPonto.mutate({ pontoId: p.id, campo: "retorno_almoco" })}>
                                  <Play className="h-3 w-3" />Retorno
                                </Button>
                              )}
                              <Button size="sm" variant="destructive" className="gap-1 text-xs"
                                onClick={() => registrarPonto.mutate({ pontoId: p.id, campo: "saida" })}>
                                <LogOut className="h-3 w-3" />Saída
                              </Button>
                            </>
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

        {/* Dialog Registrar Entrada */}
        <Dialog open={showNovo} onOpenChange={setShowNovo}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Entrada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Funcionário</Label>
                <Select value={novoFuncId} onValueChange={setNovoFuncId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovo(false)}>Cancelar</Button>
              <Button onClick={() => registrarPonto.mutate({ campo: "entrada" })} disabled={!novoFuncId || registrarPonto.isPending}>
                <LogIn className="h-4 w-4 mr-2" />Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Editar Ponto */}
        <Dialog open={showEditar} onOpenChange={setShowEditar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Ponto — {pontoEditando?.funcionarios?.nome}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entrada</Label>
                <Input type="time" value={editForm.entrada} onChange={e => setEditForm({ ...editForm, entrada: e.target.value })} />
              </div>
              <div>
                <Label>Saída Almoço</Label>
                <Input type="time" value={editForm.saida_almoco} onChange={e => setEditForm({ ...editForm, saida_almoco: e.target.value })} />
              </div>
              <div>
                <Label>Retorno Almoço</Label>
                <Input type="time" value={editForm.retorno_almoco} onChange={e => setEditForm({ ...editForm, retorno_almoco: e.target.value })} />
              </div>
              <div>
                <Label>Saída</Label>
                <Input type="time" value={editForm.saida} onChange={e => setEditForm({ ...editForm, saida: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditar(false)}>Cancelar</Button>
              <Button onClick={() => editarPonto.mutate()} disabled={editarPonto.isPending}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
