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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Clock, Users, Edit, Calendar, Sun, Moon, Truck, Plus, Pencil, Trash2, Loader2, MapPin,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfWeek, addDays } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";
import { ptBR } from "date-fns/locale";

// ─── Escalas Tab ────────────────────────────────────────────────────────────

interface Escala {
  id: string;
  entregador_id: string;
  rota_definida_id: string | null;
  data: string;
  turno_inicio: string;
  turno_fim: string;
  status: string;
  observacoes: string | null;
  entregadores: { nome: string } | null;
  rotas_definidas: { nome: string } | null;
}

function EscalasTab() {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [entregadores, setEntregadores] = useState<{ id: string; nome: string }[]>([]);
  const [rotasDefinidas, setRotasDefinidas] = useState<{ id: string; nome: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEscala, setEditingEscala] = useState<Escala | null>(null);

  const [entregadorId, setEntregadorId] = useState("");
  const [rotaId, setRotaId] = useState("");
  const [data, setData] = useState("");
  const [turnoInicio, setTurnoInicio] = useState("08:00");
  const [turnoFim, setTurnoFim] = useState("18:00");
  const [observacoes, setObservacoes] = useState("");

  const [filtroSemana, setFiltroSemana] = useState(() => {
    const hoje = getBrasiliaDate();
    return format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd");
  });

  const fetchAll = async () => {
    setIsLoading(true);
    const inicioSemana = new Date(filtroSemana);
    const fimSemana = addDays(inicioSemana, 6);

    const [escalasRes, entregadoresRes, rotasRes] = await Promise.all([
      supabase
        .from("escalas_entregador")
        .select(`
          id, entregador_id, rota_definida_id, data, turno_inicio, turno_fim, status, observacoes,
          entregadores:entregador_id (nome),
          rotas_definidas:rota_definida_id (nome)
        `)
        .gte("data", format(inicioSemana, "yyyy-MM-dd"))
        .lte("data", format(fimSemana, "yyyy-MM-dd"))
        .order("data")
        .order("turno_inicio"),
      (() => { let q = supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome"); if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id); return q; })(),
      (() => { let q = supabase.from("rotas_definidas").select("id, nome").eq("ativo", true).order("nome"); if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id); return q; })(),
    ]);

    if (escalasRes.data) setEscalas(escalasRes.data as unknown as Escala[]);
    if (entregadoresRes.data) setEntregadores(entregadoresRes.data);
    if (rotasRes.data) setRotasDefinidas(rotasRes.data as unknown as { id: string; nome: string }[]);
    setIsLoading(false);
  };

  useState(() => { fetchAll(); });

  // Re-fetch when week changes
  const prevWeek = useState(filtroSemana);
  if (prevWeek[0] !== filtroSemana) {
    prevWeek[1](filtroSemana);
    fetchAll();
  }

  const openNew = () => {
    setEditingEscala(null);
    setEntregadorId("");
    setRotaId("");
    setData(format(new Date(), "yyyy-MM-dd"));
    setTurnoInicio("08:00");
    setTurnoFim("18:00");
    setObservacoes("");
    setModalOpen(true);
  };

  const openEdit = (escala: Escala) => {
    setEditingEscala(escala);
    setEntregadorId(escala.entregador_id);
    setRotaId(escala.rota_definida_id || "");
    setData(escala.data);
    setTurnoInicio(escala.turno_inicio.slice(0, 5));
    setTurnoFim(escala.turno_fim.slice(0, 5));
    setObservacoes(escala.observacoes || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!entregadorId || !data) {
      toast({ title: "Preencha entregador e data", variant: "destructive" });
      return;
    }

    const payload = {
      entregador_id: entregadorId,
      rota_definida_id: rotaId || null,
      data,
      turno_inicio: turnoInicio,
      turno_fim: turnoFim,
      observacoes: observacoes || null,
    };

    if (editingEscala) {
      const { error } = await supabase.from("escalas_entregador").update(payload).eq("id", editingEscala.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Escala atualizada!" });
    } else {
      const { error } = await supabase.from("escalas_entregador").insert(payload);
      if (error) {
        toast({ title: error.message.includes("unique") ? "Conflito: entregador já tem escala neste dia" : error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Escala criada!" });
    }

    setModalOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("escalas_entregador").delete().eq("id", id);
    toast({ title: "Escala removida" });
    fetchAll();
  };

  const inicioSemana = new Date(filtroSemana);
  const fimSemana = addDays(inicioSemana, 6);

  const statusColor: Record<string, string> = {
    agendado: "bg-muted text-muted-foreground",
    ativo: "bg-success/10 text-success",
    concluido: "bg-primary/10 text-primary",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Escala</Button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(filtroSemana);
          d.setDate(d.getDate() - 7);
          setFiltroSemana(format(d, "yyyy-MM-dd"));
        }}>← Anterior</Button>
        <span className="font-medium text-sm">
          {format(inicioSemana, "dd/MM", { locale: ptBR })} - {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(filtroSemana);
          d.setDate(d.getDate() + 7);
          setFiltroSemana(format(d, "yyyy-MM-dd"));
        }}>Próxima →</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Entregador</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalas.map((escala) => (
                  <TableRow key={escala.id}>
                    <TableCell className="font-medium">
                      {format(new Date(escala.data + "T12:00:00"), "EEE dd/MM", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{escala.entregadores?.nome || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {escala.turno_inicio.slice(0, 5)} - {escala.turno_fim.slice(0, 5)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {escala.rotas_definidas ? (
                        <Badge variant="secondary"><MapPin className="h-3 w-3 mr-1" />{escala.rotas_definidas.nome}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[escala.status] || ""}>{escala.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(escala)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(escala.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {escalas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma escala nesta semana</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {editingEscala ? "Editar Escala" : "Nova Escala"}
            </DialogTitle>
            <DialogDescription>Defina o entregador, data, turno e rota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Entregador *</Label>
              <Select value={entregadorId} onValueChange={setEntregadorId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entregadores.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Início</Label><Input type="time" value={turnoInicio} onChange={(e) => setTurnoInicio(e.target.value)} /></div>
              <div className="space-y-2"><Label>Fim</Label><Input type="time" value={turnoFim} onChange={(e) => setTurnoFim(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Rota</Label>
              <Select value={rotaId} onValueChange={setRotaId}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {rotasDefinidas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex: Folga, troca..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Horarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      let query = supabase.from("funcionarios").select("id, nome, cargo").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores-ativos", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
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

  const openNew = () => { resetForm(); setModalOpen(true); };

  const openEdit = (h: any) => {
    setEditingId(h.id);
    if (h.entregador_id) { setTipoPessoa("entregador"); setPessoaId(h.entregador_id); }
    else { setTipoPessoa("funcionario"); setPessoaId(h.funcionario_id || ""); }
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
      turno, entrada, saida, intervalo, dias_semana: diasSemana,
      funcionario_id: tipoPessoa === "funcionario" ? pessoaId : null,
      entregador_id: tipoPessoa === "entregador" ? pessoaId : null,
      unidade_id: unidadeAtual?.id || null,
    };
    if (editingId) {
      const { error } = await supabase.from("horarios_funcionario").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Horário atualizado!" });
    } else {
      const { error } = await supabase.from("horarios_funcionario").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Horário criado!" });
    }
    setModalOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["horarios-funcionario"] });
  };

  return (
    <MainLayout>
      <Header title="Horários e Escalas" subtitle="Gestão de jornadas, turnos e escalas de entregadores" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <Tabs defaultValue="jornadas">
          <TabsList>
            <TabsTrigger value="jornadas" className="gap-1"><Clock className="h-4 w-4" />Jornadas</TabsTrigger>
            <TabsTrigger value="escalas" className="gap-1"><Calendar className="h-4 w-4" />Escalas Semanais</TabsTrigger>
          </TabsList>

          <TabsContent value="jornadas" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Button className="gap-2" onClick={openNew}>
                <Calendar className="h-4 w-4" />Novo Horário
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Com Horário</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{horarios.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Turno Manhã</CardTitle>
                  <Sun className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-warning">{turnoManha}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Turno Tarde</CardTitle>
                  <Moon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-primary">{turnoTarde}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Comercial</CardTitle>
                  <Clock className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-success">{horarios.length - turnoManha - turnoTarde}</div></CardContent>
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
                            <TableCell className="font-medium">{h.funcionarios?.nome || h.entregadores?.nome || "N/A"}</TableCell>
                            <TableCell>
                              {h.entregador_id ? (
                                <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3" />Entregador</Badge>
                              ) : h.funcionarios?.cargo || "-"}
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
                              <Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Edit className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="escalas" className="mt-4">
            <EscalasTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Jornada modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {editingId ? "Editar Horário" : "Novo Horário"}
            </DialogTitle>
            <DialogDescription>Defina o turno e horários do funcionário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoPessoa} onValueChange={(v: "funcionario" | "entregador") => { setTipoPessoa(v); setPessoaId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                  <SelectItem value="entregador">Entregador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tipoPessoa === "funcionario" ? "Funcionário" : "Entregador"} *</Label>
              <Select value={pessoaId} onValueChange={setPessoaId}>
                <SelectTrigger><SelectValue placeholder={`Selecione o ${tipoPessoa === "funcionario" ? "funcionário" : "entregador"}`} /></SelectTrigger>
                <SelectContent>
                  {tipoPessoa === "funcionario"
                    ? funcionarios.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome} {f.cargo ? `- ${f.cargo}` : ""}</SelectItem>)
                    : entregadores.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="noturno">Noturno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Entrada</Label><Input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} /></div>
              <div className="space-y-2"><Label>Saída</Label><Input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Intervalo</Label><Input value={intervalo} onChange={(e) => setIntervalo(e.target.value)} placeholder="1h" /></div>
              <div className="space-y-2"><Label>Dias da Semana</Label><Input value={diasSemana} onChange={(e) => setDiasSemana(e.target.value)} placeholder="Seg-Sex" /></div>
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
