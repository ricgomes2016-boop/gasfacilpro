import { useEffect, useState } from "react";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Target, Trophy, Star, TrendingUp, Plus, Loader2, Pencil, Trash2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface MetaForm {
  id?: string;
  titulo: string;
  descricao: string;
  tipo: string;
  valor_objetivo: number;
  valor_atual: number;
  prazo: string;
  status: string;
  unidade_id: string;
}

const emptyForm: MetaForm = {
  titulo: "",
  descricao: "",
  tipo: "vendas",
  valor_objetivo: 5000,
  valor_atual: 0,
  prazo: getBrasiliaDateString(),
  status: "ativa",
  unidade_id: "",
};

export default function MetasDesafios() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState<MetaForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Fetch unidades
  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  // Fetch metas
  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["metas-crud", unidadeAtual?.id, showAll],
    queryFn: async () => {
      let q = supabase.from("metas").select("*, unidades(nome)").order("created_at", { ascending: false });
      if (!showAll && unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch premiacoes
  const { data: premiacoes = [] } = useQuery({
    queryKey: ["premiacoes", unidadeAtual?.id],
    queryFn: async () => {
      let pq = supabase.from("premiacoes").select("*, funcionarios:ganhador_id(nome)").eq("status", "em_andamento");
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data } = await pq;
      return data || [];
    },
  });

  const openNew = () => {
    setForm({ ...emptyForm, unidade_id: unidadeAtual?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (meta: any) => {
    setForm({
      id: meta.id,
      titulo: meta.titulo,
      descricao: meta.descricao || "",
      tipo: meta.tipo,
      valor_objetivo: Number(meta.valor_objetivo),
      valor_atual: Number(meta.valor_atual),
      prazo: meta.prazo?.split("T")[0] || "",
      status: meta.status,
      unidade_id: meta.unidade_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo || !form.valor_objetivo || !form.unidade_id) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao,
        tipo: form.tipo,
        valor_objetivo: form.valor_objetivo,
        valor_atual: form.valor_atual,
        prazo: form.prazo,
        status: form.status,
        unidade_id: form.unidade_id,
      };

      if (form.id) {
        await supabase.from("metas").update(payload).eq("id", form.id);
        toast({ title: "Meta atualizada com sucesso!" });
      } else {
        await supabase.from("metas").insert(payload);
        toast({ title: "Meta criada com sucesso!" });
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["metas-crud"] });
      queryClient.invalidateQueries({ queryKey: ["daily-goal"] });
    } catch {
      toast({ title: "Erro ao salvar meta", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await supabase.from("metas").delete().eq("id", deletingId);
      toast({ title: "Meta excluída com sucesso!" });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["metas-crud"] });
      queryClient.invalidateQueries({ queryKey: ["daily-goal"] });
    } catch {
      toast({ title: "Erro ao excluir meta", variant: "destructive" });
    }
  };

  const ativas = metas.filter((m: any) => m.status === "ativa");
  const progressoMedio = ativas.length > 0
    ? ativas.reduce((s: number, m: any) => s + Math.min((Number(m.valor_atual) / Number(m.valor_objetivo)) * 100, 100), 0) / ativas.length
    : 0;

  if (isLoading) {
    return (
      <MainLayout>
        <Header title="Metas e Desafios" subtitle="Gerencie metas por unidade" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Metas e Desafios" subtitle="Gerencie metas por unidade" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
              <Store className="h-4 w-4 mr-1" />
              {showAll ? "Filtrar por Loja" : "Todas as Lojas"}
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />Nova Meta
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Target className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{ativas.length}</p><p className="text-sm text-muted-foreground">Metas Ativas</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-success/10"><TrendingUp className="h-6 w-6 text-success" /></div><div><p className="text-2xl font-bold">{progressoMedio.toFixed(0)}%</p><p className="text-sm text-muted-foreground">Média Progresso</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-warning/10"><Trophy className="h-6 w-6 text-warning" /></div><div><p className="text-2xl font-bold">{premiacoes.length}</p><p className="text-sm text-muted-foreground">Desafios Ativos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-info/10"><Star className="h-6 w-6 text-info" /></div><div><p className="text-2xl font-bold">{ativas.filter((m: any) => Number(m.valor_atual) >= Number(m.valor_objetivo)).length}</p><p className="text-sm text-muted-foreground">Metas Atingidas</p></div></div></CardContent></Card>
        </div>

        {/* Metas List */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Metas ({metas.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metas.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma meta cadastrada. Clique em "Nova Meta" para começar.</p>}
              {metas.map((meta: any) => {
                const progresso = Number(meta.valor_objetivo) > 0 ? (Number(meta.valor_atual) / Number(meta.valor_objetivo)) * 100 : 0;
                const unidadeNome = (meta.unidades as any)?.nome || "—";
                return (
                  <div key={meta.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{meta.titulo}</p>
                          <Badge variant={meta.status === "ativa" ? "default" : "secondary"}>{meta.status}</Badge>
                          <Badge variant="outline" className="gap-1"><Store className="h-3 w-3" />{unidadeNome}</Badge>
                        </div>
                        {meta.descricao && <p className="text-sm text-muted-foreground mt-1">{meta.descricao}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(meta)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(meta.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress value={Math.min(progresso, 100)} className="flex-1 h-2" />
                      <span className="text-sm font-semibold w-14 text-right">{progresso.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        R$ {Number(meta.valor_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {Number(meta.valor_objetivo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span>Prazo: {parseLocalDate(meta.prazo).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Premiacoes */}
        {premiacoes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Desafios Ativos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {premiacoes.map((d: any) => (
                  <div key={d.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium">{d.nome}</p>
                        <p className="text-sm text-muted-foreground">{d.meta_descricao}</p>
                      </div>
                      {d.premio && <Badge className="bg-warning text-warning-foreground">{d.premio}</Badge>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Líder: {(d.funcionarios as any)?.nome || "A definir"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Meta Diária de Vendas" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição da meta" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="entregas">Entregas</SelectItem>
                    <SelectItem value="clientes">Clientes</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="pausada">Pausada</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Objetivo (R$) *</Label>
                <Input type="number" value={form.valor_objetivo} onChange={(e) => setForm({ ...form, valor_objetivo: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Valor Atual (R$)</Label>
                <Input type="number" value={form.valor_atual} onChange={(e) => setForm({ ...form, valor_atual: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prazo *</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
              </div>
              <div>
                <Label>Unidade *</Label>
                <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.id ? "Salvar Alterações" : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
