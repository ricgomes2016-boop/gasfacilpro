import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Share2, Instagram, Facebook, Youtube, Music2, Check, X, Sparkles, Zap, Info } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConectarRedeSocialButton } from "@/components/marketing/ConectarRedeSocialButton";
import { CriarPaginaWizard } from "@/components/marketing/CriarPaginaWizard";

const plataformas = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { value: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground" },
  { value: "youtube", label: "YouTube", icon: Youtube, color: "text-red-500" },
];

export default function RedesSociais() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("social_accounts").insert({
        empresa_id: empresaId!,
        unidade_id: unidadeAtual?.id || null,
        plataforma: form.plataforma,
        nome_conta: form.nome_conta,
        username: form.username || null,
        conectado_via: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
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
      refresh();
      toast({ title: "Conta removida" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("social_accounts").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return (
    <MainLayout>
      <Header title="Redes Sociais" subtitle="Conecte e gerencie suas contas por unidade" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Hero — conexão real */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/0">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Conectar oficialmente (Meta)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Conecte Instagram + Facebook via OAuth para publicar automaticamente os posts agendados.
                </p>
              </div>
              <ConectarRedeSocialButton unidadeId={unidadeAtual?.id} onConnected={refresh} />
            </div>
          </CardContent>
        </Card>

        {/* Wizard criar página */}
        <Card className="border-dashed cursor-pointer hover:border-primary transition-colors" onClick={() => setWizardOpen(true)}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">Não tem página ainda? Criamos com você</h4>
              <p className="text-xs text-muted-foreground">
                Guia passo a passo com sugestões de nome, bio e logo (Instagram, Facebook, TikTok, YouTube, WhatsApp Business)
              </p>
            </div>
            <Button variant="ghost" size="sm">Abrir →</Button>
          </CardContent>
        </Card>

        {/* Avisos */}
        <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p><strong>Instagram via API</strong>: requer conta Business/Creator vinculada a uma Página do Facebook.</p>
            <p><strong>TikTok / YouTube</strong>: integrações oficiais em breve (exigem aprovação caso a caso).</p>
          </div>
        </div>

        {/* Lista de contas */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{accounts.length} conta(s) cadastrada(s)</p>
          <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Adicionar manualmente
          </Button>
        </div>

        {accounts.length === 0 && !isLoading ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Conecte via OAuth acima para publicação automática, ou cadastre manualmente como lembrete.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((acc: any) => {
              const plat = plataformas.find((p) => p.value === acc.plataforma);
              const Icon = plat?.icon || Share2;
              const isOAuth = acc.conectado_via === "oauth";
              return (
                <Card key={acc.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    {acc.profile_picture_url ? (
                      <img src={acc.profile_picture_url} alt={acc.nome_conta} className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className={`p-3 rounded-xl bg-muted/50 ${plat?.color || ""}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{acc.nome_conta}</p>
                      {acc.username && <p className="text-xs text-muted-foreground truncate">@{acc.username}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant={isOAuth ? "default" : "secondary"} className="text-[10px]">
                          {isOAuth ? "🔗 OAuth" : "Manual"}
                        </Badge>
                        <Badge variant={acc.ativo ? "default" : "outline"} className="text-[10px]">
                          {acc.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleMutation.mutate({ id: acc.id, ativo: !acc.ativo })}
                      >
                        {acc.ativo ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
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
              <DialogTitle>Adicionar Conta Manual</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Contas manuais funcionam apenas como lembrete — não publicam automaticamente.
              </p>
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

        <CriarPaginaWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </MainLayout>
  );
}
