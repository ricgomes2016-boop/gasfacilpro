import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Clock, Users, Edit, Calendar, Sun, Moon, Truck, Plus, Pencil, Trash2, Loader2, MapPin, X, CalendarDays, CalendarCheck, Sparkles, Info, UserPlus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { cn, getBrasiliaDate } from "@/lib/utils";
import { ptBR } from "date-fns/locale";

// ─── Escalas Tab ────────────────────────────────────────────────────────────

interface Escala {
  id: string;
  entregador_id: string;
  rota_definida_id: string | null;
  data: string;
  turno_inicio: string;
  turno_fim: string;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  status: string;
  observacoes: string | null;
  entregadores: { nome: string } | null;
  rotas_definidas: { nome: string } | null;
}

// Calcula horas líquidas com 3 cenários:
// 1) Almoço cadastrado → desconta intervalo real
// 2) Sem almoço, turno ≤ 6h → turno cheio (CLT não exige intervalo)
// 3) Sem almoço, turno > 6h → desconta 1h estimada (CLT mínimo)
function calcHoras(inicio: string, fim: string, almIni?: string | null, almFim?: string | null): { horas: number; estimado: boolean } {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const turnoMin = Math.max(0, toMin(fim) - toMin(inicio));
  if (almIni && almFim) {
    const alm = Math.max(0, toMin(almFim) - toMin(almIni));
    return { horas: Math.max(0, turnoMin - alm) / 60, estimado: false };
  }
  if (turnoMin > 360) {
    return { horas: Math.max(0, turnoMin - 60) / 60, estimado: true };
  }
  return { horas: turnoMin / 60, estimado: false };
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
  const [almocoInicio, setAlmocoInicio] = useState("");
  const [almocoFim, setAlmocoFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Modal "Aplicar Escala da Semana"
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEntregadorId, setBulkEntregadorId] = useState("");
  const [bulkRotaId, setBulkRotaId] = useState("");
  const [bulkInicio, setBulkInicio] = useState("08:00");
  const [bulkFim, setBulkFim] = useState("18:00");
  const [bulkAlmocoInicio, setBulkAlmocoInicio] = useState("");
  const [bulkAlmocoFim, setBulkAlmocoFim] = useState("");
  const [bulkDias, setBulkDias] = useState<boolean[]>([true, true, true, true, true, true, false]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Estado: linhas extras (entregadores adicionados manualmente à grade)
  const [extraEntregadorIds, setExtraEntregadorIds] = useState<string[]>([]);
  const [addRowOpen, setAddRowOpen] = useState(false);

  // Estado: sugestão IA
  const [iaOpen, setIaOpen] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaProposta, setIaProposta] = useState<{
    escalas: Array<{ entregador_id: string; data: string; turno_inicio: string; turno_fim: string; almoco_inicio: string | null; almoco_fim: string | null; rota_definida_id: string | null }>;
    resumo: string;
  } | null>(null);
  const [iaApplying, setIaApplying] = useState(false);

  const [filtroSemana, setFiltroSemana] = useState(() => {
    const hoje = getBrasiliaDate();
    return format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd");
  });

  const fetchAll = async () => {
    setIsLoading(true);
    const inicioSemana = parseISO(filtroSemana);
    const fimSemana = addDays(inicioSemana, 6);

    const [escalasRes, entregadoresRes, rotasRes] = await Promise.all([
      (() => {
        let q = supabase
          .from("escalas_entregador")
          .select(`
            id, entregador_id, rota_definida_id, data, turno_inicio, turno_fim, almoco_inicio, almoco_fim, status, observacoes,
            entregadores:entregador_id (nome),
            rotas_definidas:rota_definida_id (nome)
          `)
          .gte("data", format(inicioSemana, "yyyy-MM-dd"))
          .lte("data", format(fimSemana, "yyyy-MM-dd"))
          .order("data")
          .order("turno_inicio");
        if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
        return q;
      })(),
      (() => { let q = supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome"); if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id); return q; })(),
      (() => { let q = supabase.from("rotas_definidas").select("id, nome").eq("ativo", true).order("nome"); if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id); return q; })(),
    ]);

    if (escalasRes.data) setEscalas(escalasRes.data as unknown as Escala[]);
    if (entregadoresRes.data) setEntregadores(entregadoresRes.data);
    if (rotasRes.data) setRotasDefinidas(rotasRes.data as unknown as { id: string; nome: string }[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroSemana, unidadeAtual?.id]);

  const openNew = (preData?: string, preEntregador?: string) => {
    setEditingEscala(null);
    setEntregadorId(preEntregador || "");
    setRotaId("");
    setData(preData || format(new Date(), "yyyy-MM-dd"));
    setTurnoInicio("08:00");
    setTurnoFim("18:00");
    setAlmocoInicio("");
    setAlmocoFim("");
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
    setAlmocoInicio(escala.almoco_inicio ? escala.almoco_inicio.slice(0, 5) : "");
    setAlmocoFim(escala.almoco_fim ? escala.almoco_fim.slice(0, 5) : "");
    setObservacoes(escala.observacoes || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!entregadorId || !data) {
      toast({ title: "Preencha entregador e data", variant: "destructive" });
      return;
    }

    if ((almocoInicio && !almocoFim) || (!almocoInicio && almocoFim)) {
      toast({ title: "Preencha ambos os horários do almoço", variant: "destructive" });
      return;
    }
    if (almocoInicio && almocoFim && (almocoInicio <= turnoInicio || almocoFim >= turnoFim)) {
      toast({ title: "Almoço deve estar dentro do turno", variant: "destructive" });
      return;
    }

    const payload = {
      entregador_id: entregadorId,
      rota_definida_id: rotaId && rotaId !== "none" ? rotaId : null,
      data,
      turno_inicio: turnoInicio,
      turno_fim: turnoFim,
      almoco_inicio: almocoInicio || null,
      almoco_fim: almocoFim || null,
      observacoes: observacoes || null,
      unidade_id: unidadeAtual?.id || null,
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

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await supabase.from("escalas_entregador").delete().eq("id", id);
    toast({ title: "Escala removida" });
    fetchAll();
  };

  const openBulk = () => {
    setBulkEntregadorId("");
    setBulkRotaId("");
    setBulkInicio("08:00");
    setBulkFim("18:00");
    setBulkAlmocoInicio("");
    setBulkAlmocoFim("");
    setBulkDias([true, true, true, true, true, true, false]);
    setBulkOpen(true);
  };

  const handleBulkSave = async () => {
    if (!bulkEntregadorId) {
      toast({ title: "Selecione um entregador", variant: "destructive" });
      return;
    }
    if ((bulkAlmocoInicio && !bulkAlmocoFim) || (!bulkAlmocoInicio && bulkAlmocoFim)) {
      toast({ title: "Preencha ambos os horários do almoço", variant: "destructive" });
      return;
    }
    if (bulkAlmocoInicio && bulkAlmocoFim && (bulkAlmocoInicio <= bulkInicio || bulkAlmocoFim >= bulkFim)) {
      toast({ title: "Almoço deve estar dentro do turno", variant: "destructive" });
      return;
    }
    const diasSelecionados = bulkDias
      .map((checked, idx) => checked ? idx : -1)
      .filter((i) => i >= 0);

    if (diasSelecionados.length === 0) {
      toast({ title: "Selecione ao menos 1 dia", variant: "destructive" });
      return;
    }

    setBulkSaving(true);
    const inicioSemana = parseISO(filtroSemana);
    let criadas = 0;
    let conflitos = 0;

    for (const idx of diasSelecionados) {
      const dia = format(addDays(inicioSemana, idx), "yyyy-MM-dd");
      const { error } = await supabase.from("escalas_entregador").insert({
        entregador_id: bulkEntregadorId,
        rota_definida_id: bulkRotaId && bulkRotaId !== "none" ? bulkRotaId : null,
        data: dia,
        turno_inicio: bulkInicio,
        turno_fim: bulkFim,
        almoco_inicio: bulkAlmocoInicio || null,
        almoco_fim: bulkAlmocoFim || null,
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) {
        if (error.message.includes("unique") || error.code === "23505") conflitos++;
        else conflitos++;
      } else {
        criadas++;
      }
    }

    setBulkSaving(false);
    setBulkOpen(false);
    toast({
      title: "Escalas aplicadas",
      description: `${criadas} criada(s)${conflitos > 0 ? ` · ${conflitos} já existiam` : ""}`,
    });
    fetchAll();
  };

  const goHoje = () => {
    const hoje = getBrasiliaDate();
    setFiltroSemana(format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  };

  const inicioSemana = parseISO(filtroSemana);
  const fimSemana = addDays(inicioSemana, 6);
  const diasDaSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i)),
    [filtroSemana]
  );
  const hoje = getBrasiliaDate();

  // Resumo
  const totalEscalas = escalas.length;
  const entregadoresEscalados = new Set(escalas.map((e) => e.entregador_id)).size;
  const horasCalc = escalas.reduce(
    (acc, e) => {
      const c = calcHoras(e.turno_inicio, e.turno_fim, e.almoco_inicio, e.almoco_fim);
      return { total: acc.total + c.horas, estimadas: acc.estimadas + (c.estimado ? 1 : 0) };
    },
    { total: 0, estimadas: 0 }
  );
  const horasTotais = horasCalc.total;
  const escalasComAlmocoEstimado = horasCalc.estimadas;
  const diasSemCobertura = diasDaSemana.filter(
    (d) => !escalas.some((e) => e.data === format(d, "yyyy-MM-dd"))
  ).length;

  const statusBadgeClass: Record<string, string> = {
    agendado: "bg-muted text-muted-foreground border-transparent",
    ativo: "bg-success/10 text-success border-success/30",
    concluido: "bg-primary/10 text-primary border-primary/30",
    folga: "bg-warning/10 text-warning border-warning/30",
  };

  const isFolga = (escala: Escala) =>
    escala.status === "folga" || (escala.observacoes || "").toLowerCase().includes("folga");

  // Index escalas: entregador_id -> data -> Escala
  const escalasMap = useMemo(() => {
    const map = new Map<string, Map<string, Escala>>();
    for (const esc of escalas) {
      if (!map.has(esc.entregador_id)) map.set(esc.entregador_id, new Map());
      map.get(esc.entregador_id)!.set(esc.data, esc);
    }
    return map;
  }, [escalas]);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => openNew()} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Escala</Button>
          <Button variant="outline" size="sm" onClick={openBulk}>
            <CalendarCheck className="h-4 w-4 mr-1" />Aplicar Escala da Semana
          </Button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => {
          const d = parseISO(filtroSemana);
          setFiltroSemana(format(addDays(d, -7), "yyyy-MM-dd"));
        }}>← Anterior</Button>
        <Button variant="ghost" size="sm" onClick={goHoje}>Hoje</Button>
        <span className="font-medium text-sm min-w-[160px] text-center">
          {format(inicioSemana, "dd/MM", { locale: ptBR })} - {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <Button variant="outline" size="sm" onClick={() => {
          const d = parseISO(filtroSemana);
          setFiltroSemana(format(addDays(d, 7), "yyyy-MM-dd"));
        }}>Próxima →</Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xs text-muted-foreground">Total de escalas</div>
          <div className="text-2xl font-bold">{totalEscalas}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xs text-muted-foreground">Entregadores</div>
          <div className="text-2xl font-bold">{entregadoresEscalados}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xs text-muted-foreground">Horas previstas</div>
          <div className="text-2xl font-bold">{horasTotais.toFixed(1)}h</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xs text-muted-foreground">Dias sem cobertura</div>
          <div className={cn("text-2xl font-bold", diasSemCobertura > 0 ? "text-destructive" : "text-success")}>
            {diasSemCobertura}
          </div>
        </CardContent></Card>
      </div>

      {/* Grade semanal */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : entregadores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum entregador ativo nesta unidade.
            </div>
          ) : (
            <div className="overflow-x-auto w-full min-w-0">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px] border-r">
                      Entregador
                    </TableHead>
                    {diasDaSemana.map((d) => {
                      const isHoje = isSameDay(d, hoje);
                      return (
                        <TableHead
                          key={d.toISOString()}
                          className={cn(
                            "text-center min-w-[112px] w-28",
                            isHoje && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                          )}
                        >
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {format(d, "EEE", { locale: ptBR })}
                          </div>
                          <div className={cn("text-sm font-semibold", isHoje && "text-primary")}>
                            {format(d, "dd/MM", { locale: ptBR })}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregadores.map((ent) => (
                    <TableRow key={ent.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium border-r truncate max-w-[200px]">
                        {ent.nome}
                      </TableCell>
                      {diasDaSemana.map((d) => {
                        const dataStr = format(d, "yyyy-MM-dd");
                        const escala = escalasMap.get(ent.id)?.get(dataStr);
                        const isHoje = isSameDay(d, hoje);

                        if (!escala) {
                          return (
                            <TableCell
                              key={dataStr}
                              className={cn(
                                "text-center align-top p-1 cursor-pointer hover:bg-accent/50 transition-colors",
                                isHoje && "bg-primary/5"
                              )}
                              onClick={() => openNew(dataStr, ent.id)}
                            >
                              <span className="text-muted-foreground/60 text-lg">—</span>
                            </TableCell>
                          );
                        }

                        const folga = isFolga(escala);
                        return (
                          <TableCell
                            key={dataStr}
                            className={cn(
                              "align-top p-1.5 cursor-pointer group hover:bg-accent/50 transition-colors relative",
                              isHoje && "bg-primary/5"
                            )}
                            onClick={() => openEdit(escala)}
                            title={
                              folga
                                ? "Folga"
                                : escala.almoco_inicio && escala.almoco_fim
                                  ? `Turno: ${escala.turno_inicio.slice(0,5)}–${escala.turno_fim.slice(0,5)} • Almoço: ${escala.almoco_inicio.slice(0,5)}–${escala.almoco_fim.slice(0,5)} • Líquido: ${calcHoras(escala.turno_inicio, escala.turno_fim, escala.almoco_inicio, escala.almoco_fim).toFixed(1)}h`
                                  : `Turno: ${escala.turno_inicio.slice(0,5)}–${escala.turno_fim.slice(0,5)} • ${calcHoras(escala.turno_inicio, escala.turno_fim).toFixed(1)}h`
                            }
                          >
                            <div className="flex flex-col gap-1 items-stretch">
                              {folga ? (
                                <Badge className={cn("justify-center text-[10px]", statusBadgeClass.folga)}>
                                  Folga
                                </Badge>
                              ) : escala.almoco_inicio && escala.almoco_fim ? (
                                <div className="text-[11px] font-semibold text-center leading-tight">
                                  <div>{escala.turno_inicio.slice(0,5)}–{escala.almoco_inicio.slice(0,5)}</div>
                                  <div>{escala.almoco_fim.slice(0,5)}–{escala.turno_fim.slice(0,5)}</div>
                                </div>
                              ) : (
                                <div className="text-xs font-semibold text-center">
                                  {escala.turno_inicio.slice(0, 5)}-{escala.turno_fim.slice(0, 5)}
                                </div>
                              )}
                              {escala.rotas_definidas && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "justify-center text-[10px] px-1 py-0 truncate",
                                    statusBadgeClass[escala.status] || ""
                                  )}
                                >
                                  <MapPin className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                  <span className="truncate">{escala.rotas_definidas.nome}</span>
                                </Badge>
                              )}
                            </div>
                            <button
                              onClick={(e) => handleDelete(escala.id, e)}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                              aria-label="Excluir"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova/Editar Escala */}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saída Almoço <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="time" value={almocoInicio} onChange={(e) => setAlmocoInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Retorno Almoço <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="time" value={almocoFim} onChange={(e) => setAlmocoFim(e.target.value)} />
              </div>
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

      {/* Modal Aplicar Escala da Semana */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Aplicar Escala da Semana
            </DialogTitle>
            <DialogDescription>
              Replica o turno do entregador para os dias selecionados da semana visível.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Entregador *</Label>
              <Select value={bulkEntregadorId} onValueChange={setBulkEntregadorId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entregadores.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Início</Label><Input type="time" value={bulkInicio} onChange={(e) => setBulkInicio(e.target.value)} /></div>
              <div className="space-y-2"><Label>Fim</Label><Input type="time" value={bulkFim} onChange={(e) => setBulkFim(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saída Almoço <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="time" value={bulkAlmocoInicio} onChange={(e) => setBulkAlmocoInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Retorno Almoço <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="time" value={bulkAlmocoFim} onChange={(e) => setBulkAlmocoFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rota</Label>
              <Select value={bulkRotaId} onValueChange={setBulkRotaId}>
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
              <Label>Dias da semana</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {diasDaSemana.map((d, idx) => (
                  <label
                    key={idx}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-md border cursor-pointer transition-colors",
                      bulkDias[idx] ? "bg-primary/10 border-primary" : "hover:bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={bulkDias[idx]}
                      onCheckedChange={(checked) => {
                        const next = [...bulkDias];
                        next[idx] = !!checked;
                        setBulkDias(next);
                      }}
                    />
                    <span className="text-[10px] uppercase">{format(d, "EEE", { locale: ptBR })}</span>
                    <span className="text-[10px] text-muted-foreground">{format(d, "dd/MM")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)} className="flex-1" disabled={bulkSaving}>Cancelar</Button>
              <Button onClick={handleBulkSave} className="flex-1" disabled={bulkSaving}>
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
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
