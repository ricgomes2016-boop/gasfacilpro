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
  Clock, Users, Edit, Calendar, Sun, Moon, Truck, Plus, Pencil, Trash2, Loader2, MapPin, X, CalendarDays, CalendarCheck, Sparkles, Info, UserPlus, Activity, Flame, AlertTriangle, LayoutGrid, List, Star,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
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

  // Filtra: somente entregadores com ao menos 1 escala na semana + extras adicionados
  const entregadoresVisiveis = useMemo(() => {
    const idsComEscala = new Set(escalas.map((e) => e.entregador_id));
    const idsTotais = new Set([...idsComEscala, ...extraEntregadorIds]);
    return entregadores
      .filter((e) => idsTotais.has(e.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [entregadores, escalas, extraEntregadorIds]);

  // Limpa extras que já têm escala (não precisa mais ser "extra")
  useEffect(() => {
    const idsComEscala = new Set(escalas.map((e) => e.entregador_id));
    setExtraEntregadorIds((prev) => prev.filter((id) => !idsComEscala.has(id)));
  }, [escalas]);

  const entregadoresDisponiveisParaAdicionar = useMemo(
    () => entregadores.filter((e) => !entregadoresVisiveis.some((v) => v.id === e.id)),
    [entregadores, entregadoresVisiveis]
  );

  // Sugestão IA
  const handleSugerirIA = async () => {
    setIaLoading(true);
    setIaProposta(null);
    setIaOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("sugerir-escala-ia", {
        body: { unidade_id: unidadeAtual?.id || null, inicio_semana: filtroSemana },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setIaProposta(data);
    } catch (e: any) {
      toast({ title: "Erro ao gerar sugestão", description: e.message || "Tente novamente", variant: "destructive" });
      setIaOpen(false);
    } finally {
      setIaLoading(false);
    }
  };

  const handleAplicarIA = async () => {
    if (!iaProposta) return;
    setIaApplying(true);
    let criadas = 0;
    let conflitos = 0;
    for (const esc of iaProposta.escalas) {
      const { error } = await supabase.from("escalas_entregador").insert({
        entregador_id: esc.entregador_id,
        data: esc.data,
        turno_inicio: esc.turno_inicio,
        turno_fim: esc.turno_fim,
        almoco_inicio: esc.almoco_inicio || null,
        almoco_fim: esc.almoco_fim || null,
        rota_definida_id: esc.rota_definida_id || null,
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) conflitos++;
      else criadas++;
    }
    setIaApplying(false);
    setIaOpen(false);
    setIaProposta(null);
    toast({
      title: "Escala sugerida aplicada",
      description: `${criadas} turno(s) criado(s)${conflitos > 0 ? ` · ${conflitos} já existiam` : ""}`,
    });
    fetchAll();
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => openNew()} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Escala</Button>
          <Button variant="outline" size="sm" onClick={openBulk}>
            <CalendarCheck className="h-4 w-4 mr-1" />Aplicar Escala da Semana
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSugerirIA}
            disabled={iaLoading}
            className="border-primary/30 text-primary hover:bg-primary/5"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Sugerir Escala (IA)
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
          <div className="text-xs text-muted-foreground">Horas previstas (líquidas)</div>
          <div className="text-2xl font-bold">{horasTotais.toFixed(1)}h</div>
          {escalasComAlmocoEstimado > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Info className="h-3 w-3" />
              {escalasComAlmocoEstimado} com almoço estimado
            </div>
          )}
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
          ) : entregadoresVisiveis.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <div className="text-sm text-muted-foreground">
                Nenhuma escala cadastrada nesta semana.
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={() => openNew()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />Criar primeira escala
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddRowOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" />Adicionar entregador à semana
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full min-w-0">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 w-32 max-w-[128px] sm:w-40 sm:max-w-[160px] px-2 border-r text-xs">
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
                  {entregadoresVisiveis.map((ent) => (
                    <TableRow key={ent.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium border-r px-2 w-32 max-w-[128px] sm:w-40 sm:max-w-[160px]">
                        <div className="truncate text-sm" title={ent.nome}>{ent.nome}</div>
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
                        const c = calcHoras(escala.turno_inicio, escala.turno_fim, escala.almoco_inicio, escala.almoco_fim);
                        const tooltip = folga
                          ? "Folga"
                          : escala.almoco_inicio && escala.almoco_fim
                            ? `Turno: ${escala.turno_inicio.slice(0,5)}–${escala.turno_fim.slice(0,5)} • Almoço: ${escala.almoco_inicio.slice(0,5)}–${escala.almoco_fim.slice(0,5)} • Líquido: ${c.horas.toFixed(1)}h`
                            : c.estimado
                              ? `Turno: ${escala.turno_inicio.slice(0,5)}–${escala.turno_fim.slice(0,5)} • Líquido: ${c.horas.toFixed(1)}h (almoço estimado: 1h — não cadastrado, cadastre para precisão)`
                              : `Turno: ${escala.turno_inicio.slice(0,5)}–${escala.turno_fim.slice(0,5)} • ${c.horas.toFixed(1)}h`;
                        return (
                          <TableCell
                            key={dataStr}
                            className={cn(
                              "align-top p-1.5 cursor-pointer group hover:bg-accent/50 transition-colors relative",
                              isHoje && "bg-primary/5"
                            )}
                            onClick={() => openEdit(escala)}
                            title={tooltip}
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
                                <div className="text-xs font-semibold text-center flex items-center justify-center gap-0.5">
                                  <span>{escala.turno_inicio.slice(0, 5)}-{escala.turno_fim.slice(0, 5)}</span>
                                  {c.estimado && <Info className="h-2.5 w-2.5 text-warning shrink-0" />}
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
              {entregadoresDisponiveisParaAdicionar.length > 0 && (
                <div className="border-t p-3 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddRowOpen(true)}
                    className="text-muted-foreground"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Adicionar entregador à semana
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Adicionar entregador à semana */}
      <Dialog open={addRowOpen} onOpenChange={setAddRowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Adicionar entregador à semana
            </DialogTitle>
            <DialogDescription>
              Inclui o entregador na grade para você criar escalas clicando nas células.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-[50vh] overflow-y-auto">
            {entregadoresDisponiveisParaAdicionar.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos os entregadores já estão na grade.
              </p>
            ) : (
              entregadoresDisponiveisParaAdicionar.map((e) => (
                <Button
                  key={e.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setExtraEntregadorIds((prev) => [...prev, e.id]);
                    setAddRowOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {e.nome}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Sugestão IA */}
      <Dialog open={iaOpen} onOpenChange={(o) => { if (!iaApplying) setIaOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Sugestão Inteligente de Escala
            </DialogTitle>
            <DialogDescription>
              Proposta gerada com base no histórico de 4 semanas e na demanda de pedidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {iaLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">A IA está analisando o histórico...</p>
              </div>
            ) : iaProposta ? (
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
                  <strong className="text-primary">Estratégia:</strong> {iaProposta.resumo}
                </div>
                <div className="text-xs text-muted-foreground">
                  {iaProposta.escalas.length} turno(s) propostos. Conflitos com escalas existentes serão ignorados.
                </div>
                <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Entregador</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Turno</TableHead>
                        <TableHead className="text-xs">Almoço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {iaProposta.escalas.map((esc, i) => {
                        const ent = entregadores.find((e) => e.id === esc.entregador_id);
                        return (
                          <TableRow key={i} className="bg-primary/5">
                            <TableCell className="text-xs py-1.5">{ent?.nome || esc.entregador_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs py-1.5">{format(parseISO(esc.data), "EEE dd/MM", { locale: ptBR })}</TableCell>
                            <TableCell className="text-xs py-1.5">{esc.turno_inicio}–{esc.turno_fim}</TableCell>
                            <TableCell className="text-xs py-1.5">
                              {esc.almoco_inicio && esc.almoco_fim ? `${esc.almoco_inicio}–${esc.almoco_fim}` : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIaOpen(false)} className="flex-1" disabled={iaApplying}>
                    Descartar
                  </Button>
                  <Button onClick={handleAplicarIA} className="flex-1" disabled={iaApplying}>
                    {iaApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Aplicar tudo (${iaProposta.escalas.length})`}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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

// ─── Cobertura Horária Tab ─────────────────────────────────────────────────

interface EscalaCob {
  id: string;
  entregador_id: string;
  data: string;
  turno_inicio: string;
  turno_fim: string;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  unidade_id: string | null;
  entregadores: { nome: string } | null;
  unidades: { nome: string; cidade: string | null } | null;
}

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HORA_INICIO = 6;
const HORA_FIM = 23;

const toMinCob = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

function fmtHora(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getBlocosTrabalho(esc: EscalaCob): Array<[number, number]> {
  const ini = toMinCob(esc.turno_inicio);
  const fim = toMinCob(esc.turno_fim);
  if (esc.almoco_inicio && esc.almoco_fim) {
    const aIni = toMinCob(esc.almoco_inicio);
    const aFim = toMinCob(esc.almoco_fim);
    return [[ini, aIni], [aFim, fim]];
  }
  return [[ini, fim]];
}

function CoberturaTab() {
  const { unidadeAtual } = useUnidade();
  const [filtroSemana, setFiltroSemana] = useState(() => {
    const hoje = getBrasiliaDate();
    return format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd");
  });
  const [incluirCidade, setIncluirCidade] = useState(false);
  const [modo, setModo] = useState<"heatmap" | "lista">("heatmap");

  const inicioSemana = parseISO(filtroSemana);
  const fimSemana = addDays(inicioSemana, 6);
  const diasDaSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i)),
    [filtroSemana]
  );

  // Cidade da unidade atual
  const { data: unidadeInfo } = useQuery({
    queryKey: ["cob-unidade-info", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return null;
      const { data } = await supabase.from("unidades").select("id, cidade, empresa_id").eq("id", unidadeAtual.id).maybeSingle();
      return data;
    },
    enabled: !!unidadeAtual?.id,
  });

  // Unidades da mesma cidade (incluindo a atual)
  const { data: unidadesCidade = [] } = useQuery({
    queryKey: ["cob-unidades-cidade", unidadeInfo?.empresa_id, unidadeInfo?.cidade],
    queryFn: async () => {
      if (!unidadeInfo?.empresa_id || !unidadeInfo?.cidade) return [];
      const { data } = await supabase
        .from("unidades")
        .select("id, nome, cidade")
        .eq("empresa_id", unidadeInfo.empresa_id)
        .eq("cidade", unidadeInfo.cidade);
      return data || [];
    },
    enabled: !!unidadeInfo?.empresa_id && !!unidadeInfo?.cidade,
  });

  const unidadeIds = useMemo(() => {
    if (incluirCidade && unidadesCidade.length > 0) return unidadesCidade.map((u) => u.id);
    return unidadeAtual?.id ? [unidadeAtual.id] : [];
  }, [incluirCidade, unidadesCidade, unidadeAtual?.id]);

  // Escalas da semana
  const { data: escalas = [], isLoading } = useQuery<EscalaCob[]>({
    queryKey: ["cob-escalas", filtroSemana, unidadeIds.join(",")],
    queryFn: async () => {
      if (unidadeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("escalas_entregador")
        .select(`
          id, entregador_id, data, turno_inicio, turno_fim, almoco_inicio, almoco_fim, unidade_id,
          entregadores:entregador_id (nome),
          unidades:unidade_id (nome, cidade)
        `)
        .gte("data", format(inicioSemana, "yyyy-MM-dd"))
        .lte("data", format(fimSemana, "yyyy-MM-dd"))
        .in("unidade_id", unidadeIds);
      if (error) throw error;
      return (data || []) as unknown as EscalaCob[];
    },
    enabled: unidadeIds.length > 0,
  });

  // Pico de pedidos por hora (últimas 4 semanas)
  const { data: picosHora = [] } = useQuery({
    queryKey: ["cob-picos-pedidos", unidadeIds.join(",")],
    queryFn: async () => {
      if (unidadeIds.length === 0) return [];
      const dataInicio = format(addDays(getBrasiliaDate(), -28), "yyyy-MM-dd");
      const { data } = await supabase
        .from("pedidos")
        .select("created_at")
        .in("unidade_id", unidadeIds)
        .gte("created_at", dataInicio)
        .limit(5000);
      const contagem = new Map<number, number>();
      (data || []).forEach((p: any) => {
        const h = new Date(p.created_at).getHours();
        contagem.set(h, (contagem.get(h) || 0) + 1);
      });
      const arr = Array.from(contagem.entries()).map(([h, c]) => ({ hora: h, count: c }));
      const max = Math.max(1, ...arr.map((a) => a.count));
      // Considera "pico" horas com >= 70% do máximo
      return arr.filter((a) => a.count >= max * 0.7).map((a) => a.hora);
    },
    enabled: unidadeIds.length > 0,
  });

  // Mapa: dia da semana (0=seg .. 6=dom) -> hora -> entregadores
  const cobertura = useMemo(() => {
    const map: Record<number, Record<number, Array<{ id: string; nome: string; unidade: string | null; outraUnidade: boolean }>>> = {};
    for (let d = 0; d < 7; d++) {
      map[d] = {};
      for (let h = HORA_INICIO; h <= HORA_FIM; h++) map[d][h] = [];
    }
    for (const esc of escalas) {
      const dataEsc = parseISO(esc.data);
      // dia da semana 1=seg .. 0=dom -> normalizar p/ 0=seg..6=dom
      const dow = (dataEsc.getDay() + 6) % 7;
      const blocos = getBlocosTrabalho(esc);
      const outraUnidade = !!unidadeAtual?.id && esc.unidade_id !== unidadeAtual.id;
      for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
        const horaMin = h * 60;
        const ativo = blocos.some(([ini, fim]) => horaMin >= ini && horaMin < fim);
        if (ativo) {
          map[dow][h].push({
            id: esc.entregador_id,
            nome: esc.entregadores?.nome || "—",
            unidade: esc.unidades?.nome || null,
            outraUnidade,
          });
        }
      }
    }
    return map;
  }, [escalas, unidadeAtual?.id]);

  // Estatísticas
  const totalEntregadores = useMemo(() => new Set(escalas.map((e) => e.entregador_id)).size, [escalas]);
  const horasHomem = useMemo(() => {
    let total = 0;
    for (const esc of escalas) {
      for (const [ini, fim] of getBlocosTrabalho(esc)) total += Math.max(0, fim - ini);
    }
    return total / 60;
  }, [escalas]);

  // Pico médio (para 🔥)
  const picoMedio = useMemo(() => {
    const counts: number[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
        const c = cobertura[d][h].length;
        if (c > 0) counts.push(c);
      }
    }
    if (counts.length === 0) return 0;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    return Math.ceil(avg);
  }, [cobertura]);

  // Buracos de cobertura em horários de pico
  const buracos = useMemo(() => {
    const out: Array<{ dia: number; hora: number }> = [];
    for (const h of picosHora) {
      if (h < HORA_INICIO || h > HORA_FIM) continue;
      for (let d = 0; d < 7; d++) {
        if (cobertura[d][h].length === 0) out.push({ dia: d, hora: h });
      }
    }
    return out.slice(0, 10);
  }, [cobertura, picosHora]);

  function celulaClasse(count: number) {
    if (count === 0) return "bg-muted/40 text-muted-foreground";
    if (count === 1) return "bg-primary/10 text-foreground";
    if (count <= 3) return "bg-primary/25 text-foreground font-medium";
    return "bg-success/30 text-foreground font-semibold";
  }

  // Lista por dia
  const escalasPorDia = useMemo(() => {
    const out: Record<number, EscalaCob[]> = {};
    for (let d = 0; d < 7; d++) out[d] = [];
    for (const esc of escalas) {
      const dow = (parseISO(esc.data).getDay() + 6) % 7;
      out[dow].push(esc);
    }
    for (let d = 0; d < 7; d++) {
      out[d].sort((a, b) => (a.entregadores?.nome || "").localeCompare(b.entregadores?.nome || "", "pt-BR"));
    }
    return out;
  }, [escalas]);

  const goHoje = () => {
    const hoje = getBrasiliaDate();
    setFiltroSemana(format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Filtros e navegação */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border bg-muted/30 p-0.5">
            <button
              onClick={() => setModo("heatmap")}
              className={cn(
                "px-3 py-1.5 text-xs rounded flex items-center gap-1 transition-colors",
                modo === "heatmap" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Heatmap
            </button>
            <button
              onClick={() => setModo("lista")}
              className={cn(
                "px-3 py-1.5 text-xs rounded flex items-center gap-1 transition-colors",
                modo === "lista" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" /> Lista por dia
            </button>
          </div>
          {unidadesCidade.length > 1 && (
            <label className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border cursor-pointer hover:bg-muted/40">
              <Switch checked={incluirCidade} onCheckedChange={setIncluirCidade} />
              <span>Incluir unidades da mesma cidade ({unidadeInfo?.cidade})</span>
            </label>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setFiltroSemana(format(addDays(parseISO(filtroSemana), -7), "yyyy-MM-dd"))}>← Anterior</Button>
        <Button variant="ghost" size="sm" onClick={goHoje}>Hoje</Button>
        <span className="font-medium text-sm min-w-[160px] text-center">
          {format(inicioSemana, "dd/MM", { locale: ptBR })} - {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <Button variant="outline" size="sm" onClick={() => setFiltroSemana(format(addDays(parseISO(filtroSemana), 7), "yyyy-MM-dd"))}>Próxima →</Button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">Entregadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalEntregadores}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">Horas-homem</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{horasHomem.toFixed(0)}h</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">Pico médio</CardTitle>
            <Flame className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{picoMedio}</div></CardContent>
        </Card>
        <Card className={buracos.length > 0 ? "border-destructive/40" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">Buracos no pico</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", buracos.length > 0 ? "text-destructive" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", buracos.length > 0 ? "text-destructive" : "")}>{buracos.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Buracos no pico */}
      {buracos.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Horários sem cobertura (pico de pedidos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {buracos.map((b, i) => (
                <Badge key={i} variant="outline" className="border-destructive/40 text-destructive text-xs">
                  {DIAS_LABEL[b.dia]} · {String(b.hora).padStart(2, "0")}:00
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : modo === "heatmap" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Cobertura por hora × dia</span>
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning fill-warning" /> hora de pico</span>
                <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-destructive" /> acima da média</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <TooltipProvider delayDuration={150}>
              <table className="w-full border-collapse text-xs min-w-[600px]">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 font-medium text-muted-foreground sticky left-0 bg-background w-16">Hora</th>
                    {diasDaSemana.map((d, i) => (
                      <th key={i} className="p-1.5 font-medium text-center">
                        <div>{DIAS_LABEL[i]}</div>
                        <div className="text-[10px] text-muted-foreground">{format(d, "dd/MM")}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i).map((h) => {
                    const isPico = picosHora.includes(h);
                    return (
                      <tr key={h}>
                        <td className="p-1.5 sticky left-0 bg-background font-mono text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {isPico && <Star className="h-3 w-3 text-warning fill-warning" />}
                            {String(h).padStart(2, "0")}:00
                          </div>
                        </td>
                        {Array.from({ length: 7 }, (_, d) => {
                          const lista = cobertura[d][h];
                          const count = lista.length;
                          const acima = picoMedio > 0 && count > picoMedio;
                          return (
                            <td key={d} className="p-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "h-9 rounded flex items-center justify-center gap-1 cursor-default transition-all hover:ring-2 hover:ring-primary/40",
                                      celulaClasse(count),
                                      isPico && count === 0 && "ring-1 ring-destructive/40"
                                    )}
                                  >
                                    <span>{count}</span>
                                    {acima && <Flame className="h-3 w-3 text-destructive" />}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs font-semibold mb-1">
                                    {DIAS_LABEL[d]} · {String(h).padStart(2, "0")}:00
                                  </div>
                                  {count === 0 ? (
                                    <div className="text-xs text-muted-foreground">Sem cobertura</div>
                                  ) : (
                                    <ul className="text-xs space-y-0.5">
                                      {lista.map((p, idx) => (
                                        <li key={idx}>
                                          • {p.nome}
                                          {p.outraUnidade && p.unidade && (
                                            <span className="text-muted-foreground"> ({p.unidade})</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TooltipProvider>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {diasDaSemana.map((d, idx) => {
            const lista = escalasPorDia[idx];
            const totalDia = new Set(lista.map((e) => e.entregador_id)).size;
            return (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="uppercase tracking-wide">
                      {DIAS_LABEL[idx]} · {format(d, "dd/MM", { locale: ptBR })}
                    </span>
                    <Badge variant="outline">{totalDia} entregador{totalDia !== 1 ? "es" : ""}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lista.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Sem escalas neste dia</p>
                  ) : (
                    <ul className="divide-y">
                      {lista.map((esc) => {
                        const blocos = getBlocosTrabalho(esc);
                        const totalMin = blocos.reduce((acc, [a, b]) => acc + (b - a), 0);
                        const outra = !!unidadeAtual?.id && esc.unidade_id !== unidadeAtual.id;
                        return (
                          <li key={esc.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">{esc.entregadores?.nome || "—"}</span>
                              {outra && esc.unidades?.nome && (
                                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                  <MapPin className="h-3 w-3" />{esc.unidades.nome}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-muted-foreground">
                                {blocos.map(([a, b], i) => (
                                  <span key={i}>
                                    {i > 0 && <span className="mx-1">·</span>}
                                    {fmtHora(a)}–{fmtHora(b)}
                                  </span>
                                ))}
                              </span>
                              <Badge variant="secondary" className="text-[10px] h-5">{(totalMin / 60).toFixed(1)}h</Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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
