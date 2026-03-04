import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Plus, Pencil, Trash2, Megaphone, Store, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface CanalVenda {
  id: string;
  nome: string;
  tipo: string;
  parceiro_id: string | null;
  ativo: boolean;
  descricao: string | null;
  unidade_id: string | null;
  created_at: string;
}

export default function CanaisVenda() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCanal, setEditingCanal] = useState<CanalVenda | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "fixo",
    descricao: "",
  });

  const { data: canais = [], isLoading } = useQuery({
    queryKey: ["canais_venda", unidadeAtual?.id],
    queryFn: async () => {
      const query = supabase
        .from("canais_venda" as any)
        .select("*")
        .order("tipo")
        .order("nome");
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CanalVenda[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (canal: { nome: string; tipo: string; descricao: string; id?: string }) => {
      if (canal.id) {
        const { error } = await supabase
          .from("canais_venda" as any)
          .update({ nome: canal.nome, tipo: canal.tipo, descricao: canal.descricao } as any)
          .eq("id", canal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("canais_venda" as any)
          .insert({ nome: canal.nome, tipo: canal.tipo, descricao: canal.descricao, unidade_id: unidadeAtual?.id || null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canais_venda"] });
      toast.success(editingCanal ? "Canal atualizado!" : "Canal criado!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar canal"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("canais_venda" as any)
        .update({ ativo } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canais_venda"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("canais_venda" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canais_venda"] });
      toast.success("Canal excluído!");
    },
    onError: () => toast.error("Erro ao excluir canal"),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCanal(null);
    setFormData({ nome: "", tipo: "fixo", descricao: "" });
  };

  const openEdit = (canal: CanalVenda) => {
    setEditingCanal(canal);
    setFormData({ nome: canal.nome, tipo: canal.tipo, descricao: canal.descricao || "" });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingCanal?.id });
  };

  const tipoIcon = (tipo: string) =>
    tipo === "parceiro_vale_gas" ? <Handshake className="h-4 w-4" /> : <Store className="h-4 w-4" />;

  const totais = {
    total: canais.length,
    fixos: canais.filter(c => c.tipo === "fixo").length,
    parceiros: canais.filter(c => c.tipo === "parceiro_vale_gas").length,
    ativos: canais.filter(c => c.ativo).length,
  };

  return (
    <MainLayout>
      <Header title="Canais de Venda" subtitle="Gerencie os canais de venda do sistema" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Canal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCanal ? "Editar Canal" : "Novo Canal de Venda"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.nome}
                    onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Disk Entrega"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.tipo} onValueChange={v => setFormData(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Fixo</SelectItem>
                      <SelectItem value="parceiro_vale_gas">Parceiro Vale Gás</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.tipo === "parceiro_vale_gas"
                      ? "Quando o cliente pagar com vale gás desse parceiro, o canal será atribuído automaticamente."
                      : "Canal padrão de origem da venda."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={formData.descricao}
                    onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descrição do canal"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {editingCanal ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10"><Megaphone className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{totais.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10"><Store className="h-6 w-6 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{totais.fixos}</p>
                  <p className="text-sm text-muted-foreground">Fixos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10"><Handshake className="h-6 w-6 text-amber-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{totais.parceiros}</p>
                  <p className="text-sm text-muted-foreground">Parceiros Vale Gás</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10"><Megaphone className="h-6 w-6 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{totais.ativos}</p>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Canais</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canais.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum canal cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {canais.map(canal => (
                    <TableRow key={canal.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tipoIcon(canal.tipo)}
                          <span className="font-medium">{canal.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={canal.tipo === "parceiro_vale_gas" ? "secondary" : "outline"}>
                          {canal.tipo === "parceiro_vale_gas" ? "Parceiro Vale Gás" : "Fixo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {canal.descricao || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={canal.ativo}
                          onCheckedChange={ativo => toggleMutation.mutate({ id: canal.id, ativo })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(canal)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir canal "{canal.nome}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Pedidos que já usam esse canal não serão afetados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(canal.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info sobre vale gás */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Handshake className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium">Integração com Vale Gás</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Canais do tipo <strong>"Parceiro Vale Gás"</strong> são dinâmicos. Quando um cliente paga com vale gás, 
                  o sistema identifica automaticamente o parceiro emissor do vale e atribui o canal de venda correspondente ao pedido. 
                  Isso permite rastrear a performance de cada parceiro nos relatórios de vendas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
