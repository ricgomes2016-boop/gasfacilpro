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
import { Plus, Trash2, Share2, Instagram, Facebook, Youtube, Music2, Check, X, Sparkles, Zap, CheckCircle2, Link2, RefreshCw, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CriarPaginaWizard } from "@/components/marketing/CriarPaginaWizard";
import { MetaAppStatusBanner } from "@/components/marketing/MetaAppStatusBanner";
import { ConectarRedesModal } from "@/components/marketing/ConectarRedesModal";
import { StatusConexaoRedes } from "@/components/marketing/StatusConexaoRedes";

const plataformas = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-primary" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-info" },
  { value: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground" },
  { value: "youtube", label: "YouTube", icon: Youtube, color: "text-destructive" },
];

export default function RedesSociais() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [conectarModalOpen, setConectarModalOpen] = useState(false);
  const [form, setForm] = useState({ plataforma: "instagram", nome_conta: "", username: "" });
  const [statusMap, setStatusMap] = useState<Record<string, { status: string; message: string; expires_in_days: number | null }>>({});
  const [testingId, setTestingId] = useState<string | "all" | null>(null);

  const testConnection = async (accountId?: string) => {
    if (!empresaId) return;
    setTestingId(accountId || "all");
    try {
      const { data, error } = await supabase.functions.invoke("meta-test-connection", {
        body: accountId ? { account_id: accountId } : { empresa_id: empresaId },
      });
      if (error) throw error;
      const results = (data as any)?.results || [];
      const next: typeof statusMap = { ...statusMap };
      for (const r of results) {
        next[r.id] = { status: r.status, message: r.message, expires_in_days: r.expires_in_days };
      }
      setStatusMap(next);
      const ok = results.filter((r: any) => r.status === "connected").length;
      const warn = results.filter((r: any) => r.status === "expiring").length;
      const bad = results.filter((r: any) => r.status === "needs_reauth").length;
      toast({
        title: accountId ? "Conexão testada" : "Contas testadas",
        description: `${ok} ok · ${warn} expirando · ${bad} reautenticar`,
      });
      refresh();
    } catch (e: any) {
      toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["social-accounts", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_accounts")
        .select("id, empresa_id, unidade_id, plataforma, nome_conta, username, token_expires_at, avatar_url, ativo, created_at, updated_at, page_id, ig_business_id, scopes, conectado_via, profile_picture_url, external_id")
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
        <MetaAppStatusBanner />

        <StatusConexaoRedes
          empresaId={empresaId}
          contas={accounts as any}
          onConectar={() => setConectarModalOpen(true)}
        />


        {/* Hero — botão único de conexão */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/0">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Conectar rede social</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Faça login direto na plataforma e pronto — posts agendados publicam sozinhos.
                </p>
              </div>
              <Button size="lg" onClick={() => setConectarModalOpen(true)} className="gap-2">
                <Link2 className="h-4 w-4" />
                Conectar rede social
              </Button>
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
                Guia passo a passo com sugestões de nome, bio e logo
              </p>
            </div>
            <Button variant="ghost" size="sm">Abrir →</Button>
          </CardContent>
        </Card>

        {/* Lista de contas */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">{accounts.length} conta(s) cadastrada(s)</p>
          <div className="flex gap-2">
            <Button
              onClick={() => testConnection()}
              size="sm"
              variant="outline"
              disabled={testingId !== null || accounts.length === 0}
            >
              {testingId === "all" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Testar todas
            </Button>
            <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Adicionar manualmente
            </Button>
          </div>
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
              const substituida = !isOAuth && accounts.some(
                (o: any) => o.conectado_via === "oauth" && o.plataforma === acc.plataforma,
              );
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
                      {isOAuth && acc.token_expires_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Token válido até {format(new Date(acc.token_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {isOAuth ? (
                                <Badge className="gap-1 bg-success/15 text-success dark:text-success border border-success/30 hover:bg-success/20 text-[10px]">
                                  <CheckCircle2 className="h-3 w-3" /> Conectado via OAuth
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Cadastro manual</Badge>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {isOAuth
                                ? "Publicação automática habilitada — posts agendados publicam sozinhos."
                                : "Apenas lembrete — não publica automaticamente."}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge variant={acc.ativo ? "default" : "outline"} className="text-[10px]">
                          {acc.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                        {substituida && (
                          <Badge className="gap-1 bg-warning/15 text-warning border border-warning/30 text-[10px]">
                            <AlertTriangle className="h-3 w-3" /> Substituída pela conexão oficial — pode remover
                          </Badge>
                        )}
                        {isOAuth && statusMap[acc.id] && (
                          <>
                            {statusMap[acc.id].status === "connected" && (
                              <Badge className="gap-1 bg-success/15 text-success dark:text-success border border-success/30 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> Testado
                              </Badge>
                            )}
                            {statusMap[acc.id].status === "expiring" && (
                              <Badge className="gap-1 bg-warning/15 text-warning dark:text-warning border border-warning/30 text-[10px]">
                                <AlertTriangle className="h-3 w-3" /> Expirando
                              </Badge>
                            )}
                            {statusMap[acc.id].status === "needs_reauth" && (
                              <Badge className="gap-1 bg-destructive/15 text-destructive dark:text-destructive border border-destructive/30 text-[10px]">
                                <XCircle className="h-3 w-3" /> Reautenticar
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      {isOAuth && statusMap[acc.id]?.message && (
                        <p className="text-[10px] text-muted-foreground mt-1">{statusMap[acc.id].message}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {isOAuth && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Testar conexão"
                          disabled={testingId !== null}
                          onClick={() => testConnection(acc.id)}
                        >
                          {testingId === acc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
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

        <ConectarRedesModal
          open={conectarModalOpen}
          onOpenChange={setConectarModalOpen}
          unidadeId={unidadeAtual?.id}
          contasConectadas={accounts as any}
          onConnected={refresh}
        />
      </div>
    </MainLayout>
  );
}
