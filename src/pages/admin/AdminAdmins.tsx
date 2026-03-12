import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Users, Search, Shield, Pencil, Trash2 } from "lucide-react";

interface AdminUser {
  user_id: string;
  full_name: string;
  email: string;
  empresa_id: string | null;
  empresa_nome?: string;
}

interface EmpresaOption { id: string; nome: string; }

export default function AdminAdmins() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Create form
  const [nomeAdmin, setNomeAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [empresaId, setEmpresaId] = useState("");

  // Edit form
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmpresaId, setEditEmpresaId] = useState("");

  // Delete
  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    const [rolesRes, empresasRes] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    setEmpresas(empresasRes.data || []);

    if (rolesRes.data && rolesRes.data.length > 0) {
      const userIds = rolesRes.data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, empresa_id")
        .in("user_id", userIds);

      const adminList: AdminUser[] = (profiles || []).map((p) => ({
        ...p,
        empresa_nome: empresasRes.data?.find((e) => e.id === p.empresa_id)?.nome || "Sem empresa",
      }));
      setAdmins(adminList);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!nomeAdmin.trim() || !emailAdmin.trim() || !senhaAdmin.trim() || !empresaId) {
      toast.error("Preencha todos os campos"); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create", email: emailAdmin, password: senhaAdmin,
          full_name: nomeAdmin, role: "admin", empresa_id: empresaId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Admin criado e vinculado à empresa!");
      setDialogOpen(false);
      setNomeAdmin(""); setEmailAdmin(""); setSenhaAdmin(""); setEmpresaId("");
      fetchData();
    } catch (error: any) { toast.error("Erro: " + error.message); }
    finally { setSaving(false); }
  };

  const openEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditNome(admin.full_name);
    setEditEmpresaId(admin.empresa_id || "");
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingAdmin || !editNome.trim() || !editEmpresaId) {
      toast.error("Preencha todos os campos"); return;
    }
    setSaving(true);
    try {
      // Update name via manage-users edge function
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "update",
          user_id: editingAdmin.user_id,
          full_name: editNome,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update empresa_id on profile (super_admin has RLS access)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ empresa_id: editEmpresaId })
        .eq("user_id", editingAdmin.user_id);
      if (profileError) throw profileError;

      toast.success("Admin atualizado com sucesso!");
      setEditDialogOpen(false);
      setEditingAdmin(null);
      fetchData();
    } catch (error: any) { toast.error("Erro: " + error.message); }
    finally { setSaving(false); }
  };

  const filtered = admins.filter((a) =>
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.empresa_nome || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Administradores
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {admins.length} {admins.length === 1 ? "administrador" : "administradores"} vinculados a empresas.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
                <Plus className="h-4 w-4 mr-2" />
                Novo Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Admin de Empresa</DialogTitle>
                <DialogDescription>
                  Este usuário terá acesso administrativo completo à empresa selecionada.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input value={senhaAdmin} onChange={(e) => setSenhaAdmin(e.target.value)} type="password" placeholder="Mínimo 6 caracteres" />
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Admin
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email ou empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/80" />
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Administrador</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Empresa</TableHead>
                  <TableHead className="font-semibold">Perfil</TableHead>
                  <TableHead className="font-semibold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {search ? "Nenhum admin encontrado." : "Nenhum admin cadastrado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.user_id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                            {a.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          {a.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{a.empresa_nome}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Editar admin">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Administrador</DialogTitle>
              <DialogDescription>
                Atualize o nome ou a empresa vinculada a este administrador.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Email</Label>
                <Input value={editingAdmin?.email || ""} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={editEmpresaId} onValueChange={setEditEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleUpdate} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
