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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Truck, Plus, Search, Edit, Trash2, Phone, LinkIcon, UserCheck, CreditCard, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SignedImage } from "@/components/ui/signed-image";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Entregador {
  id: string;
  nome: string;
  cpf: string | null;
  cnh: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
  ativo: boolean | null;
  user_id: string | null;
  funcionario_id: string | null;
  terminal_id: string | null;
  foto_url: string | null;
}

interface TerminalOption {
  id: string;
  nome: string;
  numero_serie: string | null;
}

interface FuncionarioOption {
  id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
}

interface UserOption {
  user_id: string;
  full_name: string;
  email: string;
}

export default function Entregadores() {
  const emptyForm = { nome: "", cpf: "", cnh: "", telefone: "", email: "", user_id: "", funcionario_id: "", terminal_id: "", foto_url: "" };
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [terminais, setTerminais] = useState<TerminalOption[]>([]);
  const { unidadeAtual } = useUnidade();
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchEntregadores = async () => {
    let query = supabase
      .from("entregadores")
      .select("*")
      .order("nome");

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    setEntregadores((data || []).filter(e => e.ativo !== false));
    setLoading(false);
  };

  const fetchUsers = async () => {
    // Buscar usuários com role 'entregador'
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "entregador");
    
    if (rolesError || !roles?.length) return;

    const userIds = roles.map(r => r.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    if (profilesError) { console.error(profilesError); return; }
    setUsers(profiles || []);
  };

  const fetchFuncionarios = async () => {
    let query = supabase
      .from("funcionarios")
      .select("id, nome, cargo, cpf")
      .eq("ativo", true)
      .order("nome");

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    setFuncionarios(data || []);
  };

  const fetchTerminais = async () => {
    const { data } = await (supabase.from("terminais_cartao" as any).select("id, nome, numero_serie") as any);
    setTerminais((data || []) as TerminalOption[]);
  };

  useEffect(() => { 
    fetchEntregadores(); 
    fetchUsers();
    fetchFuncionarios();
    fetchTerminais();
  }, [unidadeAtual?.id]);

  const uploadFotoEntregador = async (file: File, entregadorId: string) => {
    if (!file.type.startsWith("image/")) throw new Error("Envie apenas arquivos de imagem.");
    if (file.size > 2 * 1024 * 1024) throw new Error("A foto deve ter no máximo 2MB.");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `entregadores/${entregadorId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) throw error;

    // Bucket privado: guardamos apenas o caminho (exibido via URL assinada)
    return path;
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }

    let fotoUrl = form.foto_url || null;
    if (fotoFile) {
      fotoUrl = await uploadFotoEntregador(fotoFile, editId || crypto.randomUUID());
    }

    const payload: any = {
      nome: form.nome,
      cpf: form.cpf || null,
      cnh: form.cnh || null,
      telefone: form.telefone || null,
      email: form.email || null,
      user_id: form.user_id || null,
      funcionario_id: form.funcionario_id || null,
      terminal_id: form.terminal_id || null,
      foto_url: fotoUrl,
    };
    if (unidadeAtual?.id) {
      payload.unidade_id = unidadeAtual.id;
    }

    if (editId) {
      const { error } = await supabase.from("entregadores").update(payload).eq("id", editId);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Entregador atualizado!");
    } else {
      const { error } = await supabase.from("entregadores").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Entregador cadastrado!");
    }

    setOpen(false);
    setEditId(null);
    setFotoFile(null);
    setForm(emptyForm);
    fetchEntregadores();
  };

  const handleEdit = (e: Entregador) => {
    setEditId(e.id);
    setForm({
      nome: e.nome, cpf: e.cpf || "", cnh: e.cnh || "",
      telefone: e.telefone || "", email: e.email || "",
      user_id: e.user_id || "", funcionario_id: e.funcionario_id || "",
      terminal_id: e.terminal_id || "",
      foto_url: e.foto_url || "",
    });
    setFotoFile(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("entregadores").update({ ativo: false }).eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Entregador removido");
    fetchEntregadores();
  };

  const filtered = entregadores.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    (e.cpf || "").includes(search)
  );

  const statusLabel = (s: string | null) => {
    if (s === "em_rota") return "Em Rota";
    if (s === "indisponivel") return "Indisponível";
    return "Disponível";
  };

  const statusVariant = (s: string | null) => {
    if (s === "em_rota") return "secondary" as const;
    if (s === "indisponivel") return "destructive" as const;
    return "default" as const;
  };

  // IDs de usuários já vinculados a outros entregadores
  const linkedUserIds = entregadores
    .filter(e => e.user_id && e.id !== editId)
    .map(e => e.user_id);

  const availableUsers = users.filter(u => !linkedUserIds.includes(u.user_id));

  return (
    <MainLayout>
      <Header title="Entregadores" subtitle="Cadastro de entregadores" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setFotoFile(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Entregador</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar" : "Cadastrar"} Entregador</DialogTitle>
                <DialogDescription>Preencha os dados do entregador</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nome Completo *</Label>
                  <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do entregador" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CPF</Label>
                    <Input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label>CNH</Label>
                    <Input value={form.cnh} onChange={e => setForm({...form, cnh: e.target.value})} placeholder="Número da CNH" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-1">
                    <Image className="h-3.5 w-3.5" />
                    Foto do entregador
                  </Label>
                  <div className="mt-2 flex items-center gap-3">
                    {form.foto_url && !fotoFile && (
                      <SignedImage value={form.foto_url} bucket="avatars" alt={form.nome} className="h-14 w-14 rounded-full object-cover" />
                    )}
                    <Input type="file" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Use JPG, PNG ou WebP até 2MB.</p>
                </div>

                <div>
                  <Label className="flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    Funcionário Vinculado
                  </Label>
                  <Select value={form.funcionario_id} onValueChange={(v) => {
                    const selected = funcionarios.find(f => f.id === v);
                    if (selected && v !== "none") {
                      setForm({...form, funcionario_id: v, nome: selected.nome, cpf: selected.cpf || form.cpf});
                    } else {
                      setForm({...form, funcionario_id: v === "none" ? "" : v});
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um funcionário (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {funcionarios.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}{f.cargo ? ` - ${f.cargo}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao selecionar, o nome e CPF serão preenchidos automaticamente.
                  </p>
                </div>

                <div>
                  <Label className="flex items-center gap-1">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Vincular ao Usuário do Sistema
                  </Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({...form, user_id: v === "none" ? "" : v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {availableUsers.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.full_name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vincule a um usuário com perfil "entregador" para acesso ao app.
                  </p>
                </div>

                <div>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Maquininha padrão do entregador. Pode ser trocada via QR Code no app.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave}>{editId ? "Salvar" : "Cadastrar"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{entregadores.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Disponíveis</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{entregadores.filter(e => e.status === "disponivel" || !e.status).length}</div></CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Em Rota</CardTitle>
              <Truck className="h-4 w-4 text-secondary-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{entregadores.filter(e => e.status === "em_rota").length}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">Lista de Entregadores</CardTitle>
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
                     <TableHead className="hidden md:table-cell">CPF</TableHead>
                     <TableHead className="hidden lg:table-cell">CNH</TableHead>
                     <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                     <TableHead className="hidden lg:table-cell">Vinculado</TableHead>
                     <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => {
                    const linkedUser = users.find(u => u.user_id === e.user_id);
                    return (
                       <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell className="hidden md:table-cell">{e.cpf || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{e.cnh || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{e.telefone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.telefone}</span> : "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {linkedUser ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <LinkIcon className="h-3 w-3" />
                              {linkedUser.email}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Não vinculado</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={statusVariant(e.status)} className="text-xs">{statusLabel(e.status)}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum entregador encontrado</TableCell></TableRow>
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
