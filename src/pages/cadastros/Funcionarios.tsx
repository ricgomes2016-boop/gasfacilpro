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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Plus, Search, Edit, Trash2, Phone, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  salario: number | null;
  status: string | null;
  ativo: boolean | null;
}

const emptyForm = {
  nome: "", cpf: "", telefone: "", email: "",
  cargo: "", setor: "", data_admissao: "", salario: "", endereco: "",
};

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const { unidadeAtual } = useUnidade();

  const fetchFuncionarios = async () => {
    let query = supabase
      .from("funcionarios")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    setFuncionarios(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFuncionarios(); }, [unidadeAtual?.id]);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload: any = {
      nome: form.nome,
      cpf: form.cpf || null,
      telefone: form.telefone || null,
      email: form.email || null,
      cargo: form.cargo || null,
      setor: form.setor || null,
      data_admissao: form.data_admissao || null,
      salario: form.salario ? parseFloat(form.salario) : 0,
      endereco: form.endereco || null,
    };
    if (!editId && unidadeAtual?.id) {
      payload.unidade_id = unidadeAtual.id;
    }

    if (editId) {
      const { error } = await supabase.from("funcionarios").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Funcionário atualizado!");
    } else {
      const { error } = await supabase.from("funcionarios").insert(payload);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      toast.success("Funcionário cadastrado!");
    }
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    fetchFuncionarios();
  };

  const handleEdit = (f: Funcionario) => {
    setForm({
      nome: f.nome,
      cpf: f.cpf || "",
      telefone: f.telefone || "",
      email: f.email || "",
      cargo: f.cargo || "",
      setor: f.setor || "",
      data_admissao: f.data_admissao || "",
      salario: f.salario?.toString() || "",
      endereco: "",
    });
    setEditId(f.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("funcionarios").update({ ativo: false }).eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Funcionário removido");
    fetchFuncionarios();
  };

  const filtered = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.cpf || "").includes(search)
  );

  const totalSalarios = funcionarios.reduce((s, f) => s + (f.salario || 0), 0);

  return (
    <MainLayout>
      <Header title="Funcionários" subtitle="Gerencie a equipe da empresa" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Funcionário" : "Cadastrar Novo Funcionário"}</DialogTitle>
                <DialogDescription>Preencha os dados do funcionário</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do funcionário" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} placeholder="Entregador, Atendente..." />
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Operacional, Vendas..." />
                </div>
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Salário</Label>
                  <Input value={form.salario} onChange={e => setForm({...form, salario: e.target.value})} placeholder="2500.00" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Rua, número, bairro" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>{editId ? "Atualizar" : "Salvar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{funcionarios.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Operacional</CardTitle>
              <Briefcase className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{funcionarios.filter(f => f.setor?.toLowerCase() === "operacional").length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Folha Mensal</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">R$ {totalSalarios.toLocaleString("pt-BR")}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Funcionários</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-10 w-[250px]" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground">Carregando...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Salário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{f.cargo || "-"}</TableCell>
                      <TableCell>{f.setor || "-"}</TableCell>
                      <TableCell>{f.telefone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{f.telefone}</span> : "-"}</TableCell>
                      <TableCell>{f.data_admissao ? new Date(f.data_admissao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>R$ {(f.salario || 0).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "ativo" ? "default" : "secondary"}>
                          {f.status || "ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum funcionário encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
