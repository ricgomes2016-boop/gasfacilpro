import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, Users, Edit, Calendar, Sun, Moon, Truck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function Horarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [tipoPessoa, setTipoPessoa] = useState<"funcionario" | "entregador">("funcionario");
  const [pessoaId, setPessoaId] = useState("");
  const [turno, setTurno] = useState("comercial");
  const [entrada, setEntrada] = useState("08:00");
  const [saida, setSaida] = useState("18:00");
  const [intervalo, setIntervalo] = useState("1h");
  const [diasSemana, setDiasSemana] = useState("Seg-Sex");

  const { data: horarios = [], isLoading } = useQuery({
    queryKey: ["horarios-funcionario", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("horarios_funcionario")
        .select("*, funcionarios(nome, cargo), entregadores(nome)")
        .order("created_at", { ascending: false });

      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-ativos", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("funcionarios")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores-ativos", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("entregadores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const turnoManha = horarios.filter((h: any) => h.turno === "manha").length;
  const turnoTarde = horarios.filter((h: any) => h.turno === "tarde").length;

  const resetForm = () => {
    setEditingId(null);
    setTipoPessoa("funcionario");
    setPessoaId("");
    setTurno("comercial");
    setEntrada("08:00");
    setSaida("18:00");
    setIntervalo("1h");
    setDiasSemana("Seg-Sex");
  };

  const openNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (h: any) => {
    setEditingId(h.id);
    if (h.entregador_id) {
      setTipoPessoa("entregador");
      setPessoaId(h.entregador_id);
    } else {
      setTipoPessoa("funcionario");
      setPessoaId(h.funcionario_id || "");
    }
    setTurno(h.turno);
    setEntrada(h.entrada?.substring(0, 5) || "08:00");
    setSaida(h.saida?.substring(0, 5) || "18:00");
    setIntervalo(h.intervalo || "1h");
    setDiasSemana(h.dias_semana || "Seg-Sex");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!pessoaId) {
      toast({ title: "Selecione um funcionário ou entregador", variant: "destructive" });
      return;
    }

    const payload: any = {
      turno,
      entrada,
      saida,
      intervalo,
      dias_semana: diasSemana,
      funcionario_id: tipoPessoa === "funcionario" ? pessoaId : null,
      entregador_id: tipoPessoa === "entregador" ? pessoaId : null,
      unidade_id: unidadeAtual?.id || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("horarios_funcionario")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Horário atualizado!" });
    } else {
      const { error } = await supabase
        .from("horarios_funcionario")
        .insert(payload);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Horário criado!" });
    }

    setModalOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["horarios-funcionario"] });
  };

  return (
    <MainLayout>
      <Header title="Horários" subtitle="Gestão de jornadas e turnos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button className="gap-2" onClick={openNew}>
            <Calendar className="h-4 w-4" />Novo Horário
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Funcionários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{horarios.length}</div>
              <p className="text-xs text-muted-foreground">Com horário definido</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Turno Manhã</CardTitle>
              <Sun className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{turnoManha}</div>
              <p className="text-xs text-muted-foreground">Funcionários</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Turno Tarde</CardTitle>
              <Moon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{turnoTarde}</div>
              <p className="text-xs text-muted-foreground">Funcionários</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comercial</CardTitle>
              <Clock className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{horarios.length - turnoManha - turnoTarde}</div>
              <p className="text-xs text-muted-foreground">Funcionários</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Quadro de Horários</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : horarios.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum horário cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horarios.map((h: any) => {
                    const turnoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", comercial: "Comercial", noturno: "Noturno" };
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">
                          {h.funcionarios?.nome || h.entregadores?.nome || "N/A"}
                        </TableCell>
                        <TableCell>
                          {h.entregador_id ? (
                            <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3" />Entregador</Badge>
                          ) : (
                            h.funcionarios?.cargo || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={h.turno === "manha" ? "default" : h.turno === "tarde" ? "secondary" : "outline"}>
                            {turnoLabel[h.turno] || h.turno}
                          </Badge>
                        </TableCell>
                        <TableCell>{h.entrada}</TableCell>
                        <TableCell>{h.saida}</TableCell>
                        <TableCell>{h.intervalo}</TableCell>
                        <TableCell>{h.dias_semana}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(h)}>
                            <Edit className="h-4 w-4" />
                          </Button>
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {editingId ? "Editar Horário" : "Novo Horário"}
            </DialogTitle>
            <DialogDescription>
              Defina o turno e horários do funcionário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoPessoa} onValueChange={(v: "funcionario" | "entregador") => { setTipoPessoa(v); setPessoaId(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                  <SelectItem value="entregador">Entregador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tipoPessoa === "funcionario" ? "Funcionário" : "Entregador"} *</Label>
              <Select value={pessoaId} onValueChange={setPessoaId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione o ${tipoPessoa === "funcionario" ? "funcionário" : "entregador"}`} />
                </SelectTrigger>
                <SelectContent>
                  {tipoPessoa === "funcionario"
                    ? funcionarios.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome} {f.cargo ? `- ${f.cargo}` : ""}
                        </SelectItem>
                      ))
                    : entregadores.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="noturno">Noturno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrada</Label>
                <Input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Saída</Label>
                <Input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intervalo</Label>
                <Input value={intervalo} onChange={(e) => setIntervalo(e.target.value)} placeholder="1h" />
              </div>
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <Input value={diasSemana} onChange={(e) => setDiasSemana(e.target.value)} placeholder="Seg-Sex" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
