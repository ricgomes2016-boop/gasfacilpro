import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, Edit, Trash2, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  tipo: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  inscricao_estadual: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  ativo: boolean | null;
}

const emptyForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  tipo: "gas",
  telefone: "",
  email: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  inscricao_estadual: "",
  contato_nome: "",
  contato_cargo: "",
};

const onlyDigits = (value?: string | null) => (value || "").replace(/\D/g, "");
const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export default function Fornecedores() {
  const { empresa } = useEmpresa();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const fetchFornecedores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fornecedores")
      .select("*")
      .eq("ativo", true)
      .order("razao_social");

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar fornecedores");
      setLoading(false);
      return;
    }

    setFornecedores((data as Fornecedor[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFornecedores(); }, [empresa?.id]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (fornecedor: Fornecedor) => {
    setEditingId(fornecedor.id);
    setForm({
      razao_social: fornecedor.razao_social || "",
      nome_fantasia: fornecedor.nome_fantasia || "",
      cnpj: fornecedor.cnpj || "",
      tipo: fornecedor.tipo || "",
      telefone: fornecedor.telefone || "",
      email: fornecedor.email || "",
      endereco: fornecedor.endereco || "",
      cidade: fornecedor.cidade || "",
      estado: fornecedor.estado || "",
      cep: fornecedor.cep || "",
      inscricao_estadual: fornecedor.inscricao_estadual || "",
      contato_nome: fornecedor.contato_nome || "",
      contato_cargo: fornecedor.contato_cargo || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const razaoSocial = form.razao_social.trim();
    if (!razaoSocial) { toast.error("Razao Social e obrigatoria"); return; }

    const cnpjAtual = onlyDigits(form.cnpj);
    const duplicado = fornecedores.find(f => {
      if (f.id === editingId) return false;
      const mesmoCnpj = cnpjAtual && onlyDigits(f.cnpj) === cnpjAtual;
      const mesmoNome = normalizeText(f.razao_social) === normalizeText(razaoSocial);
      return mesmoCnpj || mesmoNome;
    });

    if (duplicado) {
      toast.error(`Fornecedor ja cadastrado: ${duplicado.razao_social}`);
      return;
    }

    const payload = {
      razao_social: razaoSocial,
      nome_fantasia: form.nome_fantasia || null,
      cnpj: form.cnpj || null,
      tipo: form.tipo || null,
      telefone: form.telefone || null,
      email: form.email || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      cep: form.cep || null,
      inscricao_estadual: form.inscricao_estadual || null,
      contato_nome: form.contato_nome || null,
      contato_cargo: form.contato_cargo || null,
      empresa_id: empresa?.id,
    };

    const { error } = editingId
      ? await supabase.from("fornecedores").update(payload).eq("id", editingId)
      : await supabase.from("fornecedores").insert(payload);

    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
    setOpen(false);
    resetForm();
    fetchFornecedores();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Fornecedor removido");
    fetchFornecedores();
  };

  const filtered = fornecedores.filter(f =>
    f.razao_social.toLowerCase().includes(search.toLowerCase()) ||
    (f.nome_fantasia || "").toLowerCase().includes(search.toLowerCase()) ||
    onlyDigits(f.cnpj).includes(onlyDigits(search))
  );

  return (
    <MainLayout>
      <Header title="Fornecedores" subtitle="Cadastro unico para compras, estoque e contas a pagar" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Fornecedores cadastrados</h2>
            <p className="text-sm text-muted-foreground">Evite duplicidades escolhendo fornecedores cadastrados ao lancar contas.</p>
          </div>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Novo Fornecedor
          </Button>
        </div>

        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}</DialogTitle>
              <DialogDescription>Cadastre fornecedores uma vez para reutilizar no financeiro e no estoque.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Razao Social *</Label>
                <Input value={form.razao_social} onChange={e => setForm({...form, razao_social: e.target.value})} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={e => setForm({...form, nome_fantasia: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} placeholder="Gas, Agua, Servicos..." />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 0000-0000" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" />
              </div>
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input value={form.contato_nome} onChange={e => setForm({...form, contato_nome: e.target.value})} placeholder="Nome do contato" />
              </div>
              <div className="space-y-2">
                <Label>Cargo do Contato</Label>
                <Input value={form.contato_cargo} onChange={e => setForm({...form, contato_cargo: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Inscricao Estadual</Label>
                <Input value={form.inscricao_estadual} onChange={e => setForm({...form, inscricao_estadual: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={form.estado} onChange={e => setForm({...form, estado: e.target.value.toUpperCase()})} maxLength={2} placeholder="PR" />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} placeholder="00000-000" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Endereco</Label>
                <Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editingId ? "Atualizar Fornecedor" : "Salvar Fornecedor"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="kpi-card kpi-card-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{fornecedores.length}</div></CardContent>
          </Card>
          <Card className="kpi-card kpi-card-success">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gas</CardTitle>
              <Building2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{fornecedores.filter(f => f.tipo === "gas").length}</div></CardContent>
          </Card>
          <Card className="kpi-card kpi-card-warning">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outros</CardTitle>
              <Building2 className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{fornecedores.filter(f => f.tipo !== "gas").length}</div></CardContent>
          </Card>
        </div>

        <Card className="modern-panel">
          <CardHeader className="px-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Lista de Fornecedores</CardTitle>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou CNPJ..." className="w-full pl-10 sm:w-[280px]" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground">Carregando...</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razao Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          <div>{f.razao_social}</div>
                          {f.nome_fantasia && <div className="text-xs text-muted-foreground">{f.nome_fantasia}</div>}
                        </TableCell>
                        <TableCell>{f.cnpj || "-"}</TableCell>
                        <TableCell>{f.telefone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{f.telefone}</span> : "-"}</TableCell>
                        <TableCell>{f.email ? <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{f.email}</span> : "-"}</TableCell>
                        <TableCell>{[f.cidade, f.estado].filter(Boolean).join(" / ") || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{f.tipo || "-"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(f)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
