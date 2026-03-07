import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Plus, Pencil, Trash2, Loader2, Clock, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfWeek, addDays } from "date-fns";
import { getBrasiliaDate } from "@/lib/utils";
import { ptBR } from "date-fns/locale";

interface Entregador {
  id: string;
  nome: string;
}

interface RotaDefinida {
  id: string;
  nome: string;
}

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

export default function GestaoEscalas() {
  const { unidadeAtual } = useUnidade();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [rotasDefinidas, setRotasDefinidas] = useState<RotaDefinida[]>([]);
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

  const { toast } = useToast();

  useEffect(() => { fetchAll(); }, [filtroSemana]);

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
    if (rotasRes.data) setRotasDefinidas(rotasRes.data as unknown as RotaDefinida[]);
    setIsLoading(false);
  };

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
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Escala atualizada!" });
    } else {
      const { error } = await supabase.from("escalas_entregador").insert(payload);
      if (error) {
        if (error.message.includes("unique")) {
          toast({ title: "Conflito", description: "Este entregador já tem escala neste dia.", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
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

  const semanaAnterior = () => {
    const d = new Date(filtroSemana);
    d.setDate(d.getDate() - 7);
    setFiltroSemana(format(d, "yyyy-MM-dd"));
  };

  const semanaSeguinte = () => {
    const d = new Date(filtroSemana);
    d.setDate(d.getDate() + 7);
    setFiltroSemana(format(d, "yyyy-MM-dd"));
  };

  const inicioSemana = new Date(filtroSemana);
  const fimSemana = addDays(inicioSemana, 6);

  const statusColor: Record<string, string> = {
    agendado: "bg-muted text-muted-foreground",
    ativo: "bg-success/10 text-success",
    concluido: "bg-primary/10 text-primary",
  };

  return (
    <MainLayout>
      <Header title="Escalas de Entregadores" subtitle="Gerenciar escalas de trabalho" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Escala
          </Button>
        </div>

        {/* Navegação semanal */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" onClick={semanaAnterior}>← Anterior</Button>
          <span className="font-medium text-sm">
            {format(inicioSemana, "dd/MM", { locale: ptBR })} - {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={semanaSeguinte}>Próxima →</Button>
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
                          <Badge variant="secondary">
                            <MapPin className="h-3 w-3 mr-1" />
                            {escala.rotas_definidas.nome}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[escala.status] || ""}>
                          {escala.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(escala)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(escala.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {escalas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma escala nesta semana
                      </TableCell>
                    </TableRow>
                  )}
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
              <Calendar className="h-5 w-5 text-primary" />
              {editingEscala ? "Editar Escala" : "Nova Escala"}
            </DialogTitle>
            <DialogDescription>
              Defina o entregador, data, turno e rota.
            </DialogDescription>
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
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={turnoInicio} onChange={(e) => setTurnoInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={turnoFim} onChange={(e) => setTurnoFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rota</Label>
              <Select value={rotaId} onValueChange={setRotaId}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  {rotasDefinidas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex: Folga, troca com fulano..." />
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
