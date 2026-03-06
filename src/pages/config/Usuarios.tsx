import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, Trash2, Shield, Pencil, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface UserWithRoles {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  roles: AppRole[];
  unidade_ids: string[];
  created_at: string;
}

interface UnidadeOption {
  id: string;
  nome: string;
  tipo: string;
}

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  gestor: "Gestor",
  financeiro: "Financeiro",
  operacional: "Operacional",
  entregador: "Entregador",
  cliente: "Cliente",
  parceiro: "Parceiro",
  contador: "Contador",
};

// System roles available in Usuários — entregador/cliente/parceiro are managed elsewhere
const systemRoles: AppRole[] = ["admin", "gestor", "financeiro", "operacional", "contador"];

export default function Usuarios() {
  const { checkUserLimit } = usePlanLimits();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);

  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "operacional" as AppRole,
    unidade_ids: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    role: "operacional" as AppRole,
    unidade_ids: [] as string[],
  });

  useEffect(() => {
    fetchUsers();
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    const { data } = await supabase
      .from("unidades")
      .select("id, nome, tipo")
      .eq("ativo", true)
      .order("tipo")
      .order("nome");
    setUnidades(data || []);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error("Erro ao carregar usuários: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnidade = (list: string[], id: string) => {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  };

  const handleCreate = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast.error("Preencha nome, email e senha.");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    // Check plan limits before creating
    const withinLimit = await checkUserLimit();
    if (!withinLimit) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          phone: newUser.phone || undefined,
          role: newUser.role,
          unidade_ids: newUser.unidade_ids,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Usuário criado com sucesso!");
      setCreateDialogOpen(false);
      setNewUser({ full_name: "", email: "", password: "", phone: "", role: "operacional", unidade_ids: [] });
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao criar usuário: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || "",
      role: user.roles[0] || "operacional",
      unidade_ids: user.unidade_ids || [],
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    if (!editForm.full_name) {
      toast.error("Nome é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "update",
          user_id: editingUser.user_id,
          full_name: editForm.full_name,
          phone: editForm.phone || null,
          role: editForm.role,
          unidade_ids: editForm.unidade_ids,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Usuário atualizado com sucesso!");
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Usuário excluído!");
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const getUnidadeNames = (ids: string[]) => {
    if (!ids || ids.length === 0) return "Nenhuma";
    return ids
      .map((id) => unidades.find((u) => u.id === id)?.nome)
      .filter(Boolean)
      .join(", ");
  };

  const UnidadesCheckboxes = ({
    selected,
    onChange,
  }: {
    selected: string[];
    onChange: (ids: string[]) => void;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        <Building2 className="h-4 w-4" />
        Lojas com Acesso
      </Label>
      <p className="text-xs text-muted-foreground">
        Admin/Gestor vê todas automaticamente. Para outros cargos, selecione as lojas.
      </p>
      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
        {unidades.map((u) => (
          <label key={u.id} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.includes(u.id)}
              onCheckedChange={() => onChange(toggleUnidade(selected, u.id))}
            />
            <span className="text-sm">{u.nome}</span>
            <Badge variant="outline" className="text-xs capitalize ml-auto">
              {u.tipo}
            </Badge>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Usuários do Sistema" subtitle="Gerencie acessos administrativos (gestores, financeiro, operacional)" />
      <div className="p-3 sm:p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Usuários do Sistema
            </CardTitle>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                  <DialogDescription>Preencha os dados para criar um novo acesso ao sistema.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input
                      value={newUser.full_name}
                      onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Nome do usuário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={newUser.phone}
                      onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo / Perfil *</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(v) => setNewUser((p) => ({ ...p, role: v as AppRole }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {systemRoles.map((key) => (
                          <SelectItem key={key} value={key}>
                            {roleLabels[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <UnidadesCheckboxes
                    selected={newUser.unidade_ids}
                    onChange={(ids) => setNewUser((p) => ({ ...p, unidade_ids: ids }))}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cadastrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Lojas</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isAdminGestor = user.roles.includes("admin") || user.roles.includes("gestor");
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone || "—"}</TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {roleLabels[user.roles[0]] || user.roles[0] || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isAdminGestor ? (
                              <Badge variant="secondary" className="text-xs">Todas</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {getUnidadeNames(user.unidade_ids)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(user)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir <strong>{user.full_name}</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(user.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere os dados do usuário {editingUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Perfil *</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((p) => ({ ...p, role: v as AppRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {systemRoles.map((key) => (
                    <SelectItem key={key} value={key}>
                      {roleLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <UnidadesCheckboxes
              selected={editForm.unidade_ids}
              onChange={(ids) => setEditForm((p) => ({ ...p, unidade_ids: ids }))}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
