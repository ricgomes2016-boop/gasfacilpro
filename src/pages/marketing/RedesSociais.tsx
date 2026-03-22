import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Share2, Instagram, Facebook, Youtube, Music2, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const plataformas = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { value: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground" },
  { value: "youtube", label: "YouTube", icon: Youtube, color: "text-red-500" },
];

export default function RedesSociais() {
  const queryClient = useQueryClient();
  const { empresaAtual } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresaAtual?.id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ plataforma: "instagram", nome_conta: "", username: "" });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["social-accounts", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("social_accounts").insert({
        empresa_id: empresaId!,
        unidade_id: unidadeAtual?.id || null,
        plataforma: form.plataforma,
        nome_conta: form.nome_conta,
        username: form.username || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast({ title: "Conta adicionada com sucesso!" });
      setDialogOpen(false);
      setForm({ plataforma: "instagram", nome_conta: "", username: "" });
    },
    onError: () => toast({ title: "Erro ao adicionar conta", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast({ title: "Conta removida" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("social_accounts").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
  });

  return (
    <MainLayout>
      <Header title="Redes Sociais" subtitle="Conecte e gerencie suas contas por unidade" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{accounts.length} conta(s) conectada(s)</p>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Conta
          </Button>
        </div>

        {accounts.length === 0 && !isLoading ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione suas contas de redes sociais para começar a agendar posts
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Conectar Primeira Conta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((acc) => {
              const plat = plataformas.find((p) => p.value === acc.plataforma);
              const Icon = plat?.icon || Share2;
              return (
                <Card key={acc.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-muted/50 ${plat?.color || ""}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{acc.nome_conta}</p>
                      {acc.username && <p className="text-xs text-muted-foreground">@{acc.username}</p>}
                      <p className="text-xs text-muted-foreground capitalize">{acc.plataforma}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={acc.ativo ? "default" : "secondary"} className="text-[10px]">
                        {acc.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleMutation.mutate({ id: acc.id, ativo: !acc.ativo })}
                      >
                        {acc.ativo ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(acc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Conta de Rede Social</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Plataforma</label>
                <Select value={form.plataforma} onValueChange={(v) => setForm((f) => ({ ...f, plataforma: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plataformas.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome da Conta</label>
                <Input
                  value={form.nome_conta}
                  onChange={(e) => setForm((f) => ({ ...f, nome_conta: e.target.value }))}
                  placeholder="Ex: Central Gás Oficial"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Username (opcional)</label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="@centralgasoficial"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addMutation.mutate()} disabled={!form.nome_conta || addMutation.isPending}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
