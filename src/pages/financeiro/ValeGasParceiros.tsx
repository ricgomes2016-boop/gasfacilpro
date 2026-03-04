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
import { useQuery } from "@tanstack/react-query";
import { 
  Building2, Plus, CreditCard, TrendingUp, Package, Phone, Mail, UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ValeGasParceiros({ embedded }: { embedded?: boolean } = {}) {
  const { parceiros, addParceiro, getEstatisticasParceiro, refetch } = useValeGas();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyForm = { nome: "", cnpj: "", telefone: "", email: "", endereco: "", tipo: "prepago" as TipoParceiro, userId: "none" };
  const [formData, setFormData] = useState(emptyForm);

  // Fetch users with 'parceiro' role for linking
  const { data: parceiroUsers = [] } = useQuery({
    queryKey: ["parceiro-role-users"],
    queryFn: async () => {
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "parceiro");
      if (!roleData || roleData.length === 0) return [];
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      return (profiles || []) as { user_id: string; full_name: string; email: string }[];
    },
  });

  const openEdit = (parceiro: any) => {
    setEditingId(parceiro.id);
    setFormData({
      nome: parceiro.nome || "",
      cnpj: parceiro.cnpj || "",
      telefone: parceiro.telefone || "",
      email: parceiro.email || "",
      endereco: parceiro.endereco || "",
      tipo: parceiro.tipo || "prepago",
      userId: parceiro.user_id || "none",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = formData.userId === "none" ? null : formData.userId;
    try {
      if (editingId) {
        const { error } = await (supabase as any).from("vale_gas_parceiros").update({
          nome: formData.nome, cnpj: formData.cnpj, telefone: formData.telefone,
          email: formData.email, endereco: formData.endereco, tipo: formData.tipo, user_id: userId,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Parceiro atualizado!");
      } else {
        await addParceiro({ ...formData, ativo: true });
        if (userId) {
          const { data: newParceiro } = await (supabase as any).from("vale_gas_parceiros").select("id").eq("nome", formData.nome).order("created_at", { ascending: false }).limit(1).single();
          if (newParceiro) {
            await (supabase as any).from("vale_gas_parceiros").update({ user_id: userId }).eq("id", newParceiro.id);
          }
        }
        toast.success("Parceiro cadastrado!");
      }
      setDialogOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
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
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "Editar Parceiro" : "Cadastrar Parceiro"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Nome/Razão Social</Label><Input value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do parceiro" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>CNPJ</Label><Input value={formData.cnpj} onChange={e => setFormData(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" required /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input value={formData.telefone} onChange={e => setFormData(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" required /></div>
                </div>
                <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@parceiro.com" required /></div>
                <div className="space-y-2"><Label>Endereço</Label><Input value={formData.endereco} onChange={e => setFormData(p => ({ ...p, endereco: e.target.value }))} placeholder="Endereço completo" required /></div>
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
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><UserCheck className="h-4 w-4" /> Vincular Usuário (Portal)</Label>
                  <Select value={formData.userId} onValueChange={(v) => setFormData(p => ({ ...p, userId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar usuário com role 'parceiro'" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {parceiroUsers.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.full_name} ({u.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vincule um usuário com role "parceiro" para acesso ao Portal do Parceiro
                  </p>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editingId ? "Salvar" : "Cadastrar"}</Button>
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
                      <TableHead className="text-right">Valor Pendente</TableHead><TableHead className="text-center">Status</TableHead>
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
                        <Badge variant={parceiro.ativo ? "outline" : "destructive"}>{parceiro.ativo ? "Ativo" : "Inativo"}</Badge>
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
