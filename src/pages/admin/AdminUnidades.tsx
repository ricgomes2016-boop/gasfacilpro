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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, MapPin, Search, ArrowRightLeft, Building2, AlertTriangle, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Unidade {
  id: string;
  nome: string;
  tipo: string;
  empresa_id: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
}

interface EmpresaOption { id: string; nome: string; ativo: boolean; }

export default function AdminUnidades() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyActiveEmpresas, setOnlyActiveEmpresas] = useState(true);

  // New unit form
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("filial");
  const [empresaId, setEmpresaId] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Migration
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [migratingUnidade, setMigratingUnidade] = useState<Unidade | null>(null);
  const [migrateNome, setMigrateNome] = useState("");
  const [migrateCnpj, setMigrateCnpj] = useState("");
  const [migrateEmail, setMigrateEmail] = useState("");
  const [migrating, setMigrating] = useState(false);

  const fetchData = async () => {
    const [unidadesRes, empresasRes] = await Promise.all([
      supabase.from("unidades").select("id, nome, tipo, empresa_id, endereco, cidade, estado, ativo").order("nome"),
      supabase.from("empresas").select("id, nome, ativo").order("nome"),
    ]);
    setUnidades(unidadesRes.data || []);
    setEmpresas((empresasRes.data as EmpresaOption[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getEmpresa = (id: string) => empresas.find((e) => e.id === id);
  const getEmpresaNome = (id: string) => getEmpresa(id)?.nome || "—";

  const handleSave = async () => {
    if (!nome.trim() || !empresaId) { toast.error("Nome e empresa são obrigatórios"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("unidades").insert({
        nome, tipo, empresa_id: empresaId, endereco: endereco || null,
        cidade: cidade || null, estado: estado || null, ativo: true,
      });
      if (error) throw error;
      toast.success("Unidade criada!");
      setDialogOpen(false);
      setNome(""); setTipo("filial"); setEmpresaId(""); setEndereco(""); setCidade(""); setEstado("");
      fetchData();
    } catch (error: any) { toast.error("Erro: " + error.message); }
    finally { setSaving(false); }
  };

  const openMigrate = (u: Unidade) => {
    setMigratingUnidade(u);
    setMigrateNome(u.nome + " Distribuidora");
    setMigrateCnpj("");
    setMigrateEmail("");
    setMigrateDialogOpen(true);
  };

  const handleMigrateConfirm = () => {
    if (!migrateNome.trim()) { toast.error("Nome da nova empresa é obrigatório"); return; }
    setMigrateDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleMigrateExecute = async () => {
    if (!migratingUnidade) return;
    setMigrating(true);
    setConfirmDialogOpen(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("migrate-unidade", {
        body: {
          unidade_id: migratingUnidade.id,
          nova_empresa_nome: migrateNome,
          nova_empresa_cnpj: migrateCnpj || undefined,
          nova_empresa_email: migrateEmail || undefined,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      const s = res.data.summary;
      toast.success(
        `Migração concluída! "${s.unidade_migrada}" agora é empresa independente "${s.nova_empresa_nome}". ` +
        `${s.clientes_migrados} cliente(s) e ${s.usuarios_migrados} usuário(s) migrados.`
      );
      fetchData();
    } catch (err: any) {
      toast.error("Erro na migração: " + err.message);
    } finally {
      setMigrating(false);
      setMigratingUnidade(null);
    }
  };

  const empresasAtivas = empresas.filter((e) => e.ativo);
  const filtered = unidades.filter((u) => {
    const emp = getEmpresa(u.empresa_id);
    if (onlyActiveEmpresas && emp && !emp.ativo) return false;
    if (onlyActiveEmpresas && !emp) return false;
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      u.nome.toLowerCase().includes(term) ||
      getEmpresaNome(u.empresa_id).toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout>
      <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Unidades
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{filtered.length} de {unidades.length} unidades · {empresasAtivas.length} empresas ativas ({empresas.length} no total).</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center text-muted-foreground hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Toda nova empresa cadastrada no SaaS recebe automaticamente uma unidade "Matriz" criada pelo sistema. Por isso aparecem várias Matrizes de outras empresas — elas pertencem a outros tenants e ficam isoladas por RLS.
                </TooltipContent>
              </Tooltip>
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
                <Plus className="h-4 w-4 mr-2" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Unidade</DialogTitle>
                <DialogDescription>Adicione uma filial ou matriz a uma empresa existente.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>
                      {empresasAtivas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da unidade" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matriz">Matriz</SelectItem>
                        <SelectItem value="filial">Filial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} />
                  </div>
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Unidade
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Toolbar: search + filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/80" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
            <Switch checked={onlyActiveEmpresas} onCheckedChange={setOnlyActiveEmpresas} />
            Mostrar apenas empresas ativas
          </label>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Nome</TableHead>
                  <TableHead className="font-semibold">Empresa</TableHead>
                  <TableHead className="font-semibold">Tipo</TableHead>
                  <TableHead className="font-semibold">Cidade/UF</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {search ? "Nenhuma unidade encontrada." : "Nenhuma unidade cadastrada."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          {u.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{getEmpresaNome(u.empresa_id)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{u.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {[u.cidade, u.estado].filter(Boolean).join("/") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? "default" : "destructive"} className="text-xs">
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMigrate(u)}
                          title="Promover a empresa independente"
                          className="text-xs gap-1"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Migrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Migration Dialog - Step 1: Form */}
      <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Migrar para Empresa Independente
            </DialogTitle>
            <DialogDescription>
              A unidade <strong>"{migratingUnidade?.nome}"</strong> será transformada em uma empresa independente com todo o histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-400 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção:</strong> Esta operação é irreversível. Pedidos, clientes exclusivos e usuários vinculados apenas a esta unidade serão migrados.
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome da Nova Empresa *</Label>
              <Input
                value={migrateNome}
                onChange={(e) => setMigrateNome(e.target.value)}
                placeholder="Nome da nova empresa"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={migrateCnpj}
                  onChange={(e) => setMigrateCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={migrateEmail}
                  onChange={(e) => setMigrateEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p>📋 <strong>O que será migrado:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>A unidade vira <strong>matriz</strong> da nova empresa</li>
                <li>Todos os pedidos, estoque e dados financeiros (vinculados via unidade_id)</li>
                <li>Clientes exclusivos desta unidade</li>
                <li>Usuários vinculados apenas a esta unidade</li>
              </ul>
              <p className="mt-2">🔒 Clientes e usuários compartilhados com outras unidades permanecem na empresa original.</p>
            </div>

            <Button onClick={handleMigrateConfirm} className="w-full" disabled={!migrateNome.trim()}>
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Migration Dialog - Step 2: Confirmation */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Migração Irreversível
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a migrar a unidade <strong>"{migratingUnidade?.nome}"</strong> da empresa{" "}
                <strong>"{migratingUnidade ? getEmpresaNome(migratingUnidade.empresa_id) : ""}"</strong> para uma nova empresa independente chamada{" "}
                <strong>"{migrateNome}"</strong>.
              </p>
              <p className="font-semibold text-destructive">Esta ação NÃO pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMigrateExecute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={migrating}
            >
              {migrating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirmar Migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global loading overlay */}
      {migrating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Migrando unidade...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
