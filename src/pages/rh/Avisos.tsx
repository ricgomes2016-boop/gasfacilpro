import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Bell, Edit, Megaphone, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AvisoRH {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  titulo: string;
  mensagem: string;
  prioridade: "normal" | "importante" | "urgente";
  ativo: boolean;
  fixado: boolean;
  exibir_de: string;
  exibir_ate: string | null;
  created_at: string;
}

interface FormState {
  titulo: string;
  mensagem: string;
  prioridade: "normal" | "importante" | "urgente";
  unidade_id: string;
  ativo: boolean;
  fixado: boolean;
  exibir_de: string;
  exibir_ate: string;
}

const emptyForm = (): FormState => ({
  titulo: "",
  mensagem: "",
  prioridade: "normal",
  unidade_id: "nenhum",
  ativo: true,
  fixado: false,
  exibir_de: format(new Date(), "yyyy-MM-dd"),
  exibir_ate: "",
});

const modeloSST = {
  titulo: "Comunicado de SST: vacinação e prevenção em saúde",
  mensagem:
    "Comunicamos que, conforme a nova obrigatoriedade legal em SST, todos os trabalhadores devem ser informados periodicamente sobre campanhas oficiais de vacinação, como gripe e HPV, e sobre orientações preventivas relacionadas ao câncer de mama, colo do útero e próstata. A empresa reforça a importância da prevenção, do diagnóstico precoce e do acompanhamento regular de saúde.",
};

const prioridadeBadge: Record<AvisoRH["prioridade"], "outline" | "default" | "warning" | "destructive"> = {
  normal: "outline",
  importante: "warning",
  urgente: "destructive",
};

export default function Avisos() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { unidades, unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AvisoRH | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ["rh-avisos-entregador", empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("rh_avisos_entregador" as any)
        .select("*")
        .order("fixado", { ascending: false })
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data || []) as AvisoRH[];
    },
  });

  const unidadeNome = useMemo(() => {
    const map = new Map(unidades.map((u) => [u.id, u.nome]));
    return (id: string | null) => (id ? map.get(id) || "Unidade" : "Todas as unidades");
  }, [unidades]);

  const abrirNovo = () => {
    setEditing(null);
    setForm({ ...emptyForm(), unidade_id: unidadeAtual?.id || "nenhum" });
    setOpen(true);
  };

  const abrirModeloSST = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      ...modeloSST,
      prioridade: "importante",
      fixado: true,
      unidade_id: unidadeAtual?.id || "nenhum",
    });
    setOpen(true);
  };

  const abrirEditar = (aviso: AvisoRH) => {
    setEditing(aviso);
    setForm({
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      prioridade: aviso.prioridade,
      unidade_id: aviso.unidade_id || "nenhum",
      ativo: aviso.ativo,
      fixado: aviso.fixado,
      exibir_de: aviso.exibir_de,
      exibir_ate: aviso.exibir_ate || "",
    });
    setOpen(true);
  };

  const salvar = async () => {
    if (!empresa?.id || !user?.id) return;
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast({ title: "Preencha título e mensagem", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      empresa_id: empresa.id,
      unidade_id: form.unidade_id === "nenhum" ? null : form.unidade_id,
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      prioridade: form.prioridade,
      ativo: form.ativo,
      fixado: form.fixado,
      exibir_de: form.exibir_de,
      exibir_ate: form.exibir_ate || null,
      created_by: user.id,
    };

    const { error } = editing
      ? await (supabase.from("rh_avisos_entregador" as any).update(payload).eq("id", editing.id) as any)
      : await (supabase.from("rh_avisos_entregador" as any).insert(payload) as any);

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar aviso", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Aviso atualizado" : "Aviso publicado" });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["rh-avisos-entregador"] });
  };

  const excluir = async (id: string) => {
    if (!confirm("Remover este aviso?")) return;
    const { error } = await (supabase.from("rh_avisos_entregador" as any).delete().eq("id", id) as any);
    if (error) {
      toast({ title: "Erro ao remover aviso", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Aviso removido" });
    queryClient.invalidateQueries({ queryKey: ["rh-avisos-entregador"] });
  };

  return (
    <MainLayout>
      <Header title="Avisos" subtitle="Comunicados do RH exibidos no aplicativo do entregador" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Publique comunicados por unidade ou para todos os entregadores da empresa.
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={abrirModeloSST} className="gap-2">
              <AlertTriangle className="h-4 w-4" /> Modelo SST
            </Button>
            <Button onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Aviso
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> Avisos cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Carregando avisos...</div>
            ) : avisos.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhum aviso cadastrado.</div>
            ) : (
              <div className="space-y-3">
                {avisos.map((aviso) => (
                  <div key={aviso.id} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-foreground">{aviso.titulo}</h3>
                          <Badge variant={prioridadeBadge[aviso.prioridade]}>{aviso.prioridade}</Badge>
                          {aviso.fixado && <Badge variant="default">fixado</Badge>}
                          <Badge variant={aviso.ativo ? "success" : "outline"}>{aviso.ativo ? "ativo" : "inativo"}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{aviso.mensagem}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{unidadeNome(aviso.unidade_id)}</span>
                          <span>•</span>
                          <span>{aviso.exibir_de} até {aviso.exibir_ate || "sem prazo"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="icon" onClick={() => abrirEditar(aviso)} aria-label="Editar aviso">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => excluir(aviso.id)} aria-label="Excluir aviso">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
            <DialogDescription>O aviso aparecerá na tela inicial do aplicativo do entregador.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className="min-h-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unidade_id} onValueChange={(value) => setForm({ ...form, unidade_id: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Todas as unidades</SelectItem>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(value: FormState["prioridade"]) => setForm({ ...form, prioridade: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="importante">Importante</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Exibir de</Label>
                <Input type="date" value={form.exibir_de} onChange={(e) => setForm({ ...form, exibir_de: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Exibir até</Label>
                <Input type="date" value={form.exibir_ate} onChange={(e) => setForm({ ...form, exibir_ate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-xl border bg-card p-3">
                <span className="text-sm font-medium">Ativo</span>
                <Switch checked={form.ativo} onCheckedChange={(value) => setForm({ ...form, ativo: value })} />
              </label>
              <label className="flex items-center justify-between rounded-xl border bg-card p-3">
                <span className="text-sm font-medium">Fixar destaque</span>
                <Switch checked={form.fixado} onCheckedChange={(value) => setForm({ ...form, fixado: value })} />
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="gap-2">
              <Megaphone className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar aviso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
