import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Share2, Instagram, Facebook, Youtube, Music2, Check, X,
  Bot, MessageSquare, Phone, ShoppingCart, HelpCircle, AlertTriangle, Megaphone,
  Settings2, Users, Sparkles,
} from "lucide-react";
import { BrandKitTab } from "@/components/marketing/BrandKitTab";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Redes Sociais ───
const plataformas = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-primary" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-info" },
  { value: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground" },
  { value: "youtube", label: "YouTube", icon: Youtube, color: "text-destructive" },
];

// ─── Fluxos de Atendimento ───
const intencaoConfig: Record<string, { label: string; icon: any; color: string }> = {
  pedido: { label: "Pedido", icon: ShoppingCart, color: "text-success" },
  duvida: { label: "Dúvida", icon: HelpCircle, color: "text-info" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, color: "text-destructive" },
  promocao: { label: "Promoção", icon: Megaphone, color: "text-primary" },
  suporte: { label: "Suporte", icon: Settings2, color: "text-warning" },
  outro: { label: "Outro", icon: MessageSquare, color: "text-muted-foreground" },
};

export default function ConfigMarketing() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;

  // ─── Social accounts state ───
  const [socialDialogOpen, setSocialDialogOpen] = useState(false);
  const [socialForm, setSocialForm] = useState({ plataforma: "instagram", nome_conta: "", username: "" });

  const { data: accounts = [] } = useQuery({
    queryKey: ["social-accounts", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("social_accounts").select("id, empresa_id, unidade_id, plataforma, nome_conta, username, token_expires_at, avatar_url, ativo, created_at, updated_at, page_id, ig_business_id, scopes, conectado_via, profile_picture_url, external_id").eq("empresa_id", empresaId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("social_accounts").insert({
        empresa_id: empresaId!, unidade_id: unidadeAtual?.id || null,
        plataforma: socialForm.plataforma, nome_conta: socialForm.nome_conta, username: socialForm.username || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast({ title: "Conta adicionada!" });
      setSocialDialogOpen(false);
      setSocialForm({ plataforma: "instagram", nome_conta: "", username: "" });
    },
    onError: () => toast({ title: "Erro ao adicionar conta", variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => { await supabase.from("social_accounts").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["social-accounts"] }); toast({ title: "Conta removida" }); },
  });

  const toggleAccount = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => { await supabase.from("social_accounts").update({ ativo }).eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
  });

  // ─── Fluxos state ───
  const [fluxoDialogOpen, setFluxoDialogOpen] = useState(false);
  const [fluxoForm, setFluxoForm] = useState({ nome: "", intencao: "pedido", mensagem_inicial: "", transferir_humano: false });

  const { data: fluxos = [] } = useQuery({
    queryKey: ["mkt-fluxos", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("marketing_fluxos_atendimento").select("*").eq("empresa_id", empresaId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const addFluxo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marketing_fluxos_atendimento").insert({
        empresa_id: empresaId!, unidade_id: unidadeAtual?.id || null,
        nome: fluxoForm.nome, intencao: fluxoForm.intencao,
        mensagem_inicial: fluxoForm.mensagem_inicial || null, transferir_humano: fluxoForm.transferir_humano,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-fluxos"] });
      toast({ title: "Fluxo criado!" });
      setFluxoDialogOpen(false);
      setFluxoForm({ nome: "", intencao: "pedido", mensagem_inicial: "", transferir_humano: false });
    },
    onError: () => toast({ title: "Erro ao criar fluxo", variant: "destructive" }),
  });

  const deleteFluxo = useMutation({
    mutationFn: async (id: string) => { await supabase.from("marketing_fluxos_atendimento").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-fluxos"] }); toast({ title: "Fluxo removido" }); },
  });

  const toggleFluxo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => { await supabase.from("marketing_fluxos_atendimento").update({ ativo }).eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mkt-fluxos"] }),
  });

  return (
    <MainLayout>
      <Header title="Configurações de Marketing" subtitle="Brand Kit, contas de redes sociais e fluxos de atendimento" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Tabs defaultValue="brand" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="brand" className="gap-2"><Sparkles className="h-4 w-4" /> Brand Kit</TabsTrigger>
            <TabsTrigger value="contas" className="gap-2"><Share2 className="h-4 w-4" /> Contas</TabsTrigger>
            <TabsTrigger value="fluxos" className="gap-2"><Bot className="h-4 w-4" /> Fluxos</TabsTrigger>
          </TabsList>

          <TabsContent value="brand"><BrandKitTab /></TabsContent>


          {/* ─── Contas ─── */}
          <TabsContent value="contas" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{accounts.length} conta(s)</p>
              <Button onClick={() => setSocialDialogOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
            </div>
            {accounts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
                  <p className="text-sm text-muted-foreground mb-4">Adicione suas contas de redes sociais</p>
                  <Button onClick={() => setSocialDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Conectar Conta</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {accounts.map((acc) => {
                  const plat = plataformas.find((p) => p.value === acc.plataforma);
                  const Icon = plat?.icon || Share2;
                  return (
                    <Card key={acc.id} className="border-border/50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-muted/50 ${plat?.color || ""}`}><Icon className="h-5 w-5" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{acc.nome_conta}</p>
                          {acc.username && <p className="text-xs text-muted-foreground">@{acc.username}</p>}
                        </div>
                        <Badge variant={acc.ativo ? "default" : "secondary"} className="text-[10px]">{acc.ativo ? "Ativa" : "Inativa"}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAccount.mutate({ id: acc.id, ativo: !acc.ativo })}>
                          {acc.ativo ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteAccount.mutate(acc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Fluxos ─── */}
          <TabsContent value="fluxos" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{fluxos.filter((f: any) => f.ativo).length} ativo(s)</p>
              <Button onClick={() => setFluxoDialogOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Fluxo</Button>
            </div>
            {fluxos.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum fluxo criado</h3>
                  <p className="text-sm text-muted-foreground mb-4">Crie fluxos para automatizar o atendimento</p>
                  <Button onClick={() => setFluxoDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Criar Fluxo</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {fluxos.map((f: any) => {
                  const int = intencaoConfig[f.intencao] || intencaoConfig.outro;
                  const IntIcon = int.icon;
                  return (
                    <Card key={f.id} className="border-border/50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-muted/50 ${int.color}`}><IntIcon className="h-5 w-5" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{f.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{int.label}</Badge>
                            {f.transferir_humano && <Badge variant="outline" className="text-[10px] text-warning"><Users className="h-2.5 w-2.5 mr-0.5" /> Transfere</Badge>}
                          </div>
                        </div>
                        <Switch checked={f.ativo} onCheckedChange={(v) => toggleFluxo.mutate({ id: f.id, ativo: v })} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFluxo.mutate(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ─── Social Account Dialog ─── */}
        <Dialog open={socialDialogOpen} onOpenChange={setSocialDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Conta</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Plataforma</label>
                <Select value={socialForm.plataforma} onValueChange={(v) => setSocialForm((f) => ({ ...f, plataforma: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{plataformas.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome da Conta</label>
                <Input value={socialForm.nome_conta} onChange={(e) => setSocialForm((f) => ({ ...f, nome_conta: e.target.value }))} placeholder="Ex: Central Gás Oficial" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Username (opcional)</label>
                <Input value={socialForm.username} onChange={(e) => setSocialForm((f) => ({ ...f, username: e.target.value }))} placeholder="@centralgasoficial" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSocialDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addAccount.mutate()} disabled={!socialForm.nome_conta || addAccount.isPending}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Fluxo Dialog ─── */}
        <Dialog open={fluxoDialogOpen} onOpenChange={setFluxoDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Fluxo de Atendimento</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome do Fluxo</label>
                <Input value={fluxoForm.nome} onChange={(e) => setFluxoForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Pedido Rápido" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Intenção</label>
                <Select value={fluxoForm.intencao} onValueChange={(v) => setFluxoForm((f) => ({ ...f, intencao: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(intencaoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Mensagem Inicial (opcional)</label>
                <Textarea value={fluxoForm.mensagem_inicial} onChange={(e) => setFluxoForm((f) => ({ ...f, mensagem_inicial: e.target.value }))} placeholder="Mensagem automática..." rows={3} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Transferir para humano?</label>
                <Switch checked={fluxoForm.transferir_humano} onCheckedChange={(v) => setFluxoForm((f) => ({ ...f, transferir_humano: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFluxoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addFluxo.mutate()} disabled={!fluxoForm.nome || addFluxo.isPending}>Criar Fluxo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
