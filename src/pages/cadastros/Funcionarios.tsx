import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Search, Edit, Trash2, Phone, Briefcase, Truck,
  LinkIcon, CreditCard, Mail, Lock, Loader2, UserCheck,
} from "lucide-react";
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

interface Entregador {
  id: string;
  nome: string;
  funcionario_id: string | null;
  user_id: string | null;
  terminal_id: string | null;
  cnh: string | null;
  status: string | null;
}

interface TerminalOption {
  id: string;
  nome: string;
  numero_serie: string | null;
}

const emptyForm = {
  nome: "", cpf: "", telefone: "", email: "",
  cargo: "", setor: "", data_admissao: "", salario: "", endereco: "",
  is_entregador: false,
  cnh: "",
  login_email: "",
  login_password: "",
  terminal_id: "",
};

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "entregadores" | "internos">("todos");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [terminais, setTerminais] = useState<TerminalOption[]>([]);
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

  const fetchEntregadores = async () => {
    let query = supabase
      .from("entregadores")
      .select("id, nome, funcionario_id, user_id, terminal_id, cnh, status")
      .eq("ativo", true);

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data } = await query;
    setEntregadores(data || []);
  };

  const fetchTerminais = async () => {
    const { data } = await (supabase.from("terminais_cartao" as any).select("id, nome, numero_serie") as any);
    setTerminais((data || []) as TerminalOption[]);
  };

  useEffect(() => {
    fetchFuncionarios();
    fetchEntregadores();
    fetchTerminais();
  }, [unidadeAtual?.id]);

  const getEntregadorForFuncionario = (funcId: string) =>
    entregadores.find(e => e.funcionario_id === funcId);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }

    // Validate entregador login fields for new entregadores without existing user
    const existingEntregador = editId ? getEntregadorForFuncionario(editId) : null;
    const needsNewUser = form.is_entregador && !existingEntregador?.user_id;

    if (needsNewUser) {
      if (!form.login_email) {
        toast.error("Email de acesso é obrigatório para entregadores");
        return;
      }
      if (!form.login_password || form.login_password.length < 6) {
        toast.error("Senha deve ter no mínimo 6 caracteres");
        return;
      }
    }

    setSaving(true);

    try {
      const payload: any = {
        nome: form.nome,
        cpf: form.cpf || null,
        telefone: form.telefone || null,
        email: form.email || null,
        cargo: form.is_entregador ? "Entregador" : (form.cargo || null),
        setor: form.setor || null,
        data_admissao: form.data_admissao || null,
        salario: form.salario ? parseFloat(form.salario) : 0,
        endereco: form.endereco || null,
      };
      if (!editId && unidadeAtual?.id) {
        payload.unidade_id = unidadeAtual.id;
      }

      let funcionarioId = editId;

      if (editId) {
        const { error } = await supabase.from("funcionarios").update(payload).eq("id", editId);
        if (error) { toast.error("Erro ao atualizar: " + error.message); setSaving(false); return; }
      } else {
        const { data, error } = await supabase.from("funcionarios").insert(payload).select("id").single();
        if (error) { toast.error("Erro ao salvar: " + error.message); setSaving(false); return; }
        funcionarioId = data.id;
      }

      // Sync entregador record
      if (form.is_entregador && funcionarioId) {
        let userId = existingEntregador?.user_id || null;

        // Create auth user if needed
        if (needsNewUser) {
          const { data: createData, error: createError } = await supabase.functions.invoke("manage-users", {
            body: {
              action: "create",
              email: form.login_email,
              password: form.login_password,
              full_name: form.nome,
              phone: form.telefone || undefined,
              role: "entregador",
              unidade_ids: unidadeAtual?.id ? [unidadeAtual.id] : [],
            },
          });

          if (createError) {
            toast.error("Erro ao criar acesso: " + createError.message);
            setSaving(false);
            return;
          }
          if (createData?.error) {
            toast.error("Erro ao criar acesso: " + createData.error);
            setSaving(false);
            return;
          }

          userId = createData.user_id;
        }

        const existing = entregadores.find(e => e.funcionario_id === funcionarioId);
        const entregadorPayload: any = {
          nome: form.nome,
          cpf: form.cpf || null,
          cnh: form.cnh || null,
          telefone: form.telefone || null,
          email: form.login_email || form.email || null,
          user_id: userId,
          terminal_id: form.terminal_id || null,
          funcionario_id: funcionarioId,
          ativo: true,
        };
        if (unidadeAtual?.id) {
          entregadorPayload.unidade_id = unidadeAtual.id;
        }

        if (existing) {
          await supabase.from("entregadores").update(entregadorPayload).eq("id", existing.id);
        } else {
          await supabase.from("entregadores").insert(entregadorPayload);
        }
      } else if (!form.is_entregador && funcionarioId) {
        const existing = entregadores.find(e => e.funcionario_id === funcionarioId);
        if (existing) {
          await supabase.from("entregadores").update({ ativo: false }).eq("id", existing.id);
        }
      }

      toast.success(editId ? "Funcionário atualizado!" : "Funcionário cadastrado!");
      if (needsNewUser) {
        toast.success("Acesso ao app do entregador criado automaticamente!");
      }
      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      fetchFuncionarios();
      fetchEntregadores();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (f: Funcionario) => {
    const entregador = getEntregadorForFuncionario(f.id);
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
      is_entregador: !!entregador,
      cnh: entregador?.cnh || "",
      login_email: "",
      login_password: "",
      terminal_id: entregador?.terminal_id || "",
    });
    setEditId(f.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("funcionarios").update({ ativo: false }).eq("id", id);
    const linked = entregadores.find(e => e.funcionario_id === id);
    if (linked) {
      await supabase.from("entregadores").update({ ativo: false }).eq("id", linked.id);
    }
    toast.success("Funcionário removido");
    fetchFuncionarios();
    fetchEntregadores();
  };

  const entregadorFuncIds = new Set(entregadores.map(e => e.funcionario_id).filter(Boolean));

  const filtered = funcionarios.filter(f => {
    const matchSearch = f.nome.toLowerCase().includes(search.toLowerCase()) || (f.cpf || "").includes(search);
    if (!matchSearch) return false;
    if (filter === "entregadores") return entregadorFuncIds.has(f.id);
    if (filter === "internos") return !entregadorFuncIds.has(f.id);
    return true;
  });

  const totalSalarios = funcionarios.reduce((s, f) => s + (f.salario || 0), 0);
  const totalEntregadores = entregadores.length;

  return (
    <MainLayout>
      <Header title="Funcionários" subtitle="Gerencie a equipe da empresa" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <Label>E-mail Pessoal</Label>
                  <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={form.is_entregador ? "Entregador" : form.cargo}
                    onChange={e => setForm({...form, cargo: e.target.value})}
                    placeholder="Atendente, Auxiliar..."
                    disabled={form.is_entregador}
                  />
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

                {/* Entregador toggle */}
                <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">É Entregador?</Label>
                    </div>
                    <Switch
                      checked={form.is_entregador}
                      onCheckedChange={(v) => setForm({...form, is_entregador: v})}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marque para habilitar campos de entregador. O acesso ao app será criado automaticamente.
                  </p>

                  {form.is_entregador && (
                    <div className="space-y-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label>CNH</Label>
                        <Input value={form.cnh} onChange={e => setForm({...form, cnh: e.target.value})} placeholder="Número da CNH" />
                      </div>

                      {/* Login credentials - only show if no user linked yet */}
                      {(() => {
                        const existingEntregador = editId ? getEntregadorForFuncionario(editId) : null;
                        const hasUser = !!existingEntregador?.user_id;

                        if (hasUser) {
                          return (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                              <UserCheck className="h-4 w-4 text-primary" />
                              <span className="text-sm text-primary">Acesso ao app já configurado</span>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3 p-3 rounded-md bg-accent/30 border border-accent/50">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Credenciais de Acesso ao App
                            </p>
                            <p className="text-xs text-muted-foreground">
                              O entregador usará essas credenciais para acessar o app de entregas.
                            </p>
                            <div className="space-y-2">
                              <Label>Email de Login *</Label>
                              <Input
                                value={form.login_email}
                                onChange={e => setForm({...form, login_email: e.target.value})}
                                type="email"
                                placeholder="entregador@empresa.com"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1">
                                <Lock className="h-3.5 w-3.5" />
                                Senha *
                              </Label>
                              <Input
                                value={form.login_password}
                                onChange={e => setForm({...form, login_password: e.target.value})}
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                              />
                            </div>
                          </div>
                        );
                      })()}

                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5" />
                          Maquininha Fixa
                        </Label>
                        <Select value={form.terminal_id} onValueChange={(v) => setForm({...form, terminal_id: v === "none" ? "" : v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma maquininha (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {terminais.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome}{t.numero_serie ? ` (${t.numero_serie})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editId ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{funcionarios.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Entregadores</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{totalEntregadores}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Internos</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{funcionarios.length - totalEntregadores}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Folha Mensal</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">R$ {totalSalarios.toLocaleString("pt-BR")}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Equipe</CardTitle>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="todos" className="text-xs px-3 h-7">Todos</TabsTrigger>
                    <TabsTrigger value="entregadores" className="text-xs px-3 h-7">Entregadores</TabsTrigger>
                    <TabsTrigger value="internos" className="text-xs px-3 h-7">Internos</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-10 w-full sm:w-[250px] h-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? <p className="text-muted-foreground">Carregando...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead className="hidden lg:table-cell">Admissão</TableHead>
                    <TableHead className="hidden lg:table-cell">Salário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Acesso App</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(f => {
                    const entregador = getEntregadorForFuncionario(f.id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>{f.cargo || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {f.telefone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{f.telefone}</span> : "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {f.data_admissao ? new Date(f.data_admissao).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          R$ {(f.salario || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {entregador ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <Truck className="h-3 w-3" />
                              Entregador
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Interno</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {entregador?.user_id ? (
                            <Badge variant="outline" className="gap-1 text-xs text-primary">
                              <UserCheck className="h-3 w-3" />
                              Configurado
                            </Badge>
                          ) : entregador ? (
                            <span className="text-muted-foreground text-xs">Sem acesso</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
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
                    );
                  })}
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
