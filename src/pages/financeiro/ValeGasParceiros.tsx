import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useValeGas, TipoParceiro } from "@/contexts/ValeGasContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, Plus, CreditCard, TrendingUp, Package, Phone, Mail, UserCheck,
  Lock, Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function ValeGasParceiros({ embedded }: { embedded?: boolean } = {}) {
  const { parceiros, addParceiro, getEstatisticasParceiro, refetch } = useValeGas();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { unidadeAtual } = useUnidade();
  const emptyForm = {
    nome: "", cnpj: "", telefone: "", email: "", endereco: "",
    tipo: "prepago" as TipoParceiro,
    login_email: "", login_password: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  // Track which parceiros already have a user linked
  const getParceiroHasUser = (parceiro: any) => !!parceiro.user_id;

  const openEdit = (parceiro: any) => {
    setEditingId(parceiro.id);
    setFormData({
      nome: parceiro.nome || "",
      cnpj: parceiro.cnpj || "",
      telefone: parceiro.telefone || "",
      email: parceiro.email || "",
      endereco: parceiro.endereco || "",
      tipo: parceiro.tipo || "prepago",
      login_email: "",
      login_password: "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const editingParceiro = editingId ? parceiros.find(p => p.id === editingId) : null;
    const hasUser = editingParceiro ? getParceiroHasUser(editingParceiro) : false;
    const needsNewUser = !hasUser && formData.login_email && formData.login_password;

    // Validate login fields if provided
    if (formData.login_email && !formData.login_password) {
      toast.error("Preencha a senha para criar o acesso ao portal");
      return;
    }
    if (formData.login_password && formData.login_password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setSaving(true);

    try {
      let userId: string | null = editingParceiro?.user_id || null;

      // Auto-create auth user if login fields provided
      if (needsNewUser) {
        const { data: createData, error: createError } = await supabase.functions.invoke("manage-users", {
          body: {
            action: "create",
            email: formData.login_email,
            password: formData.login_password,
            full_name: formData.nome,
            phone: formData.telefone || undefined,
            role: "parceiro",
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

      if (editingId) {
        const updatePayload: any = {
          nome: formData.nome, cnpj: formData.cnpj, telefone: formData.telefone,
          email: formData.email, endereco: formData.endereco, tipo: formData.tipo,
        };
        if (userId) updatePayload.user_id = userId;

        const { error } = await (supabase as any).from("vale_gas_parceiros").update(updatePayload).eq("id", editingId);
        if (error) throw error;
        toast.success("Parceiro atualizado!");
      } else {
        await addParceiro({ ...formData, ativo: true });
        // Link user_id to the newly created parceiro
        if (userId) {
          const { data: newParceiro } = await (supabase as any)
            .from("vale_gas_parceiros")
            .select("id")
            .eq("nome", formData.nome)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          if (newParceiro) {
            await (supabase as any).from("vale_gas_parceiros").update({ user_id: userId }).eq("id", newParceiro.id);
          }
        }
        toast.success("Parceiro cadastrado!");
      }

      if (needsNewUser) {
        toast.success("Acesso ao Portal do Parceiro criado automaticamente!");
      }

      setDialogOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const totais = {
    prepago: parceiros.filter(p => p.tipo === "prepago").length,
    consignado: parceiros.filter(p => p.tipo === "consignado").length,
    ativos: parceiros.filter(p => p.ativo).length,
  };

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setFormData(emptyForm); } }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo Parceiro</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar Parceiro" : "Cadastrar Parceiro"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Nome/Razão Social *</Label><Input value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do parceiro" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>CNPJ *</Label><Input value={formData.cnpj} onChange={e => setFormData(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" required /></div>
                  <div className="space-y-2"><Label>Telefone *</Label><Input value={formData.telefone} onChange={e => setFormData(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" required /></div>
                </div>
                <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@parceiro.com" required /></div>
                <div className="space-y-2"><Label>Endereço *</Label><Input value={formData.endereco} onChange={e => setFormData(p => ({ ...p, endereco: e.target.value }))} placeholder="Endereço completo" required /></div>
                <div className="space-y-2">
                  <Label>Tipo de Parceiro</Label>
                  <Select value={formData.tipo} onValueChange={(v: TipoParceiro) => setFormData(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepago">Pré-pago (paga antecipado)</SelectItem>
                      <SelectItem value="consignado">Consignado (acerto posterior)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.tipo === "prepago" ? "Parceiro compra os vales antecipadamente" : "Parceiro recebe vales em consignação e paga após utilização"}
                  </p>
                </div>

                {/* Portal access section */}
                {(() => {
                  const editingParceiro = editingId ? parceiros.find(p => p.id === editingId) : null;
                  const hasUser = editingParceiro ? getParceiroHasUser(editingParceiro) : false;

                  if (hasUser) {
                    return (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="text-sm text-primary">Acesso ao portal já configurado</span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 p-3 rounded-md bg-accent/30 border border-accent/50">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Acesso ao Portal do Parceiro
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Crie credenciais para o parceiro acessar o portal em portal.gasfacilpro.com.br
                      </p>
                      <div className="space-y-2">
                        <Label>Email de Login</Label>
                        <Input
                          value={formData.login_email}
                          onChange={e => setFormData(p => ({ ...p, login_email: e.target.value }))}
                          type="email"
                          placeholder="parceiro@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5" />
                          Senha
                        </Label>
                        <Input
                          value={formData.login_password}
                          onChange={e => setFormData(p => ({ ...p, login_password: e.target.value }))}
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingId ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{parceiros.length}</p><p className="text-sm text-muted-foreground">Total Parceiros</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-500/10"><CreditCard className="h-6 w-6 text-blue-500" /></div><div><p className="text-2xl font-bold">{totais.prepago}</p><p className="text-sm text-muted-foreground">Pré-pago</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-amber-500/10"><Package className="h-6 w-6 text-amber-500" /></div><div><p className="text-2xl font-bold">{totais.consignado}</p><p className="text-sm text-muted-foreground">Consignado</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><TrendingUp className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">{totais.ativos}</p><p className="text-sm text-muted-foreground">Ativos</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Lista de Parceiros</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Tipo</TableHead><TableHead>Contato</TableHead>
                      <TableHead className="text-center">Total Vales</TableHead><TableHead className="text-center">Utilizados</TableHead>
                      <TableHead className="text-right">Valor Pendente</TableHead><TableHead className="text-center">Portal</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parceiros.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum parceiro cadastrado</TableCell></TableRow>
                ) : parceiros.map(parceiro => {
                  const stats = getEstatisticasParceiro(parceiro.id);
                  return (
                    <TableRow key={parceiro.id}>
                      <TableCell>
                        <div><p className="font-medium">{parceiro.nome}</p><p className="text-xs text-muted-foreground">{parceiro.cnpj}</p></div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={parceiro.tipo === "prepago" ? "default" : "secondary"}>
                          {parceiro.tipo === "prepago" ? "Pré-pago" : "Consignado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{parceiro.telefone}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{parceiro.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{stats.totalVales}</TableCell>
                      <TableCell className="text-center">{stats.valesUtilizados}</TableCell>
                      <TableCell className="text-right">
                        {stats.valorPendente > 0 ? <span className="text-amber-600 font-medium">R$ {stats.valorPendente.toFixed(2)}</span> : <span className="text-green-600">Quitado</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {getParceiroHasUser(parceiro) ? (
                          <Badge variant="outline" className="gap-1 text-xs text-primary">
                            <UserCheck className="h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Sem acesso</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(parceiro)}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Parceiros Vale Gás" subtitle="Cadastro e gestão de parceiros" />
      {content}
    </MainLayout>
  );
}
