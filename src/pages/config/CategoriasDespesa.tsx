import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Loader2, Search, FolderTree, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

interface Categoria {
  id: string;
  nome: string;
  grupo: string;
  tipo: string;
  codigo_contabil: string | null;
  descricao: string | null;
  valor_padrao: number;
  ativo: boolean;
  ordem: number;
  unidade_id?: string | null;
}

const grupoLabels: Record<string, string> = {
  custos_fixos: "Custos Fixos",
  compras_mercadorias: "Compras e Custo Direto",
  frota_entrega: "Frota e Entrega",
  ocupacao_estrutura: "Ocupacao e Estrutura",
  pessoal: "Despesas com Pessoal",
  operacional: "Despesas Operacionais",
  comercial: "Despesas Comerciais",
  administrativo: "Despesas Administrativas",
  financeiro: "Despesas Financeiras",
  impostos: "Impostos e Tributos",
  diversos: "Diversos",
};

const grupoColors: Record<string, string> = {
  custos_fixos: "bg-primary/10 text-primary border-primary/20",
  compras_mercadorias: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  frota_entrega: "bg-amber-500/10 text-amber-700 border-amber-200",
  ocupacao_estrutura: "bg-sky-500/10 text-sky-700 border-sky-200",
  pessoal: "bg-info/10 text-info border-info/20",
  operacional: "bg-warning/10 text-warning border-warning/20",
  comercial: "bg-success/10 text-success border-success/20",
  administrativo: "bg-muted text-muted-foreground border-border",
  financeiro: "bg-destructive/10 text-destructive border-destructive/20",
  impostos: "bg-accent text-accent-foreground border-border",
  diversos: "bg-muted text-muted-foreground",
};

const slugifyGrupo = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const humanizeGrupo = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Sem grupo";

const emptyForm: Omit<Categoria, "id"> = {
  nome: "",
  grupo: "operacional",
  tipo: "variavel",
  codigo_contabil: "",
  descricao: "",
  valor_padrao: 0,
  ativo: true,
  ordem: 0,
};

export default function CategoriasDespesa() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState("");

  useEffect(() => { if (!unidadeLoading) fetchCategorias(); }, [unidadeAtual?.id, unidadeLoading]);

  const fetchCategorias = async () => {
    setLoading(true);
    let query = supabase
      .from("categorias_despesa")
      .select("*")
      .order("grupo", { ascending: true })
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.is.null,unidade_id.eq.${unidadeAtual.id}`);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Erro ao carregar categorias");
      console.error(error);
    } else {
      setCategorias((data || []) as Categoria[]);
    }
    setLoading(false);
  };

  const gruposDisponiveis = useMemo(() => {
    const labels = { ...grupoLabels };
    categorias.forEach((cat) => {
      if (cat.grupo && !labels[cat.grupo]) labels[cat.grupo] = humanizeGrupo(cat.grupo);
    });
    return labels;
  }, [categorias]);

  const handleOpen = (cat?: Categoria) => {
    if (cat) {
      setEditingId(cat.id);
      setForm({
        nome: cat.nome,
        grupo: cat.grupo,
        tipo: cat.tipo,
        codigo_contabil: cat.codigo_contabil || "",
        descricao: cat.descricao || "",
        valor_padrao: cat.valor_padrao,
        ativo: cat.ativo,
        ordem: cat.ordem,
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyForm, ordem: categorias.length + 1 });
    }
    setNovoGrupo("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade antes de criar categorias");
      return;
    }
    const grupoFinal = novoGrupo.trim() ? slugifyGrupo(novoGrupo) : form.grupo;
    if (!grupoFinal) {
      toast.error("Categoria principal é obrigatória");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome,
      grupo: grupoFinal,
      tipo: form.tipo,
      codigo_contabil: form.codigo_contabil || null,
      descricao: form.descricao || null,
      valor_padrao: form.valor_padrao,
      ativo: form.ativo,
      ordem: form.ordem,
      unidade_id: unidadeAtual?.id || null,
    };

    if (editingId) {
      const { error } = await supabase.from("categorias_despesa").update(payload).eq("id", editingId);
      if (error) {
        console.error(error);
        toast.error(error.message || "Erro ao atualizar");
        setSaving(false);
        return;
      }
      toast.success("Categoria atualizada");
    } else {
      const { error } = await supabase.from("categorias_despesa").insert(payload);
      if (error) {
        console.error(error);
        toast.error(error.message || "Erro ao criar");
        setSaving(false);
        return;
      }
      toast.success("Categoria criada");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchCategorias();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    const { error } = await supabase.from("categorias_despesa").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else { toast.success("Excluída"); fetchCategorias(); }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("categorias_despesa").update({ ativo: !ativo }).eq("id", id);
    fetchCategorias();
  };

  const handleSeedDefaults = async () => {
    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade para completar as categorias");
      return;
    }

    setSeeding(true);
    const { data, error } = await supabase.rpc("seed_categorias_despesa_gas" as never, {
      _unidade_id: unidadeAtual.id,
    } as never);
    setSeeding(false);

    if (error) {
      console.error(error);
      toast.error(error.message || "Erro ao criar categorias padrão");
      return;
    }

    const criadas = Number(data || 0);
    toast.success(criadas > 0
      ? `${criadas} categorias padrão criadas com códigos contábeis`
      : "Categorias padrão já estavam completas");
    fetchCategorias();
  };

  const filtered = categorias.filter(c => {
    const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.codigo_contabil || "").includes(search) ||
      (gruposDisponiveis[c.grupo] || c.grupo).toLowerCase().includes(search.toLowerCase());
    const matchGrupo = grupoFilter === "todos" || c.grupo === grupoFilter;
    return matchSearch && matchGrupo;
  });

  // Group by grupo for display
  const grouped = Object.entries(gruposDisponiveis).reduce((acc, [key, label]) => {
    const items = filtered.filter(c => c.grupo === key);
    if (items.length > 0) acc.push({ key, label, items });
    return acc;
  }, [] as { key: string; label: string; items: Categoria[] }[]);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Categorias de Despesas" subtitle="Plano de contas de despesas" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Categorias de Despesas" subtitle="Plano de contas de despesas" />
      <div className="p-3 md:p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderTree className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{categorias.length}</p>
                  <p className="text-xs text-muted-foreground">Total de Categorias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-2xl font-bold">{categorias.filter(c => c.ativo).length}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-2xl font-bold">{categorias.filter(c => c.tipo === "fixo").length}</p>
                <p className="text-xs text-muted-foreground">Custos Fixos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-2xl font-bold">{categorias.filter(c => c.tipo === "variavel").length}</p>
                <p className="text-xs text-muted-foreground">Custos Variáveis</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Add button */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={grupoFilter} onValueChange={setGrupoFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Principais</SelectItem>
              {Object.entries(gruposDisponiveis).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handleOpen()}>
            <Plus className="h-4 w-4 mr-2" /> Nova Categoria
          </Button>
          <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding || !unidadeAtual?.id}>
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Completar padrão
          </Button>
        </div>

        {/* Table grouped */}
        {grouped.map(({ key, label, items }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className={grupoColors[key] || "bg-muted text-muted-foreground border-border"}>{label}</Badge>
                <span className="text-muted-foreground font-normal">({items.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden md:table-cell">Tipo</TableHead>
                      <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                      <TableHead className="text-center w-20">Ativo</TableHead>
                      <TableHead className="text-right w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(cat => (
                      <TableRow key={cat.id} className={!cat.ativo ? "opacity-50" : ""}>
                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">{cat.codigo_contabil || "—"}</TableCell>
                        <TableCell className="py-1.5 text-sm font-medium">{cat.nome}</TableCell>
                        <TableCell className="py-1.5 text-sm hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {cat.tipo === "fixo" ? "Fixo" : "Variável"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                          {cat.descricao || "—"}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Switch
                            checked={cat.ativo}
                            onCheckedChange={() => handleToggleAtivo(cat.id, cat.ativo)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpen(cat)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}

        {grouped.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma categoria encontrada
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria Principal</Label>
                <Select value={form.grupo} onValueChange={v => setForm(p => ({ ...p, grupo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(gruposDisponiveis).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código Contábil</Label>
                <Input value={form.codigo_contabil || ""} onChange={e => setForm(p => ({ ...p, codigo_contabil: e.target.value }))} placeholder="4.1.01" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={e => setForm(p => ({ ...p, ordem: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <Label>Nova categoria principal</Label>
                <Input value={novoGrupo} onChange={e => setNovoGrupo(e.target.value)} placeholder="Ex.: Manutenção Predial" />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao || ""} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
