import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquare, Bot, Plus, Trash2, Edit2, Check, X, Zap, Phone, ShoppingCart,
  HelpCircle, AlertTriangle, Megaphone, Settings2, ArrowRight, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const intencaoConfig: Record<string, { label: string; icon: any; color: string }> = {
  pedido: { label: "Pedido", icon: ShoppingCart, color: "text-success" },
  duvida: { label: "Dúvida", icon: HelpCircle, color: "text-info" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, color: "text-destructive" },
  promocao: { label: "Promoção", icon: Megaphone, color: "text-primary" },
  suporte: { label: "Suporte", icon: Settings2, color: "text-warning" },
  outro: { label: "Outro", icon: MessageSquare, color: "text-muted-foreground" },
};

export default function AtendimentoIA() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;
  const [tab, setTab] = useState<"fluxos" | "conversas">("fluxos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    intencao: "pedido" as string,
    mensagem_inicial: "",
    transferir_humano: false,
  });

  const { data: fluxos = [] } = useQuery({
    queryKey: ["mkt-fluxos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_fluxos_atendimento")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: conversas = [] } = useQuery({
    queryKey: ["mkt-conversas", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_conversas")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const addFluxo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marketing_fluxos_atendimento").insert({
        empresa_id: empresaId!,
        unidade_id: unidadeAtual?.id || null,
        nome: form.nome,
        intencao: form.intencao,
        mensagem_inicial: form.mensagem_inicial || null,
        transferir_humano: form.transferir_humano,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-fluxos"] });
      toast({ title: "Fluxo criado!" });
      setDialogOpen(false);
      setForm({ nome: "", intencao: "pedido", mensagem_inicial: "", transferir_humano: false });
    },
    onError: () => toast({ title: "Erro ao criar fluxo", variant: "destructive" }),
  });

  const deleteFluxo = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("marketing_fluxos_atendimento").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-fluxos"] });
      toast({ title: "Fluxo removido" });
    },
  });

  const toggleFluxo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await supabase.from("marketing_fluxos_atendimento").update({ ativo }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mkt-fluxos"] }),
  });

  const statusConversaColors: Record<string, string> = {
    ativo: "bg-success/10 text-success",
    resolvido: "bg-info/10 text-info",
    transferido: "bg-warning/10 text-warning",
    arquivado: "bg-muted text-muted-foreground",
  };

  return (
    <MainLayout>
      <Header title="Atendimento IA" subtitle="Fluxos automatizados e histórico de conversas" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={tab === "fluxos" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("fluxos")}
          >
            <Bot className="h-4 w-4 mr-1" /> Fluxos ({fluxos.length})
          </Button>
          <Button
            variant={tab === "conversas" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("conversas")}
          >
            <MessageSquare className="h-4 w-4 mr-1" /> Conversas ({conversas.length})
          </Button>
        </div>

        {tab === "fluxos" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{fluxos.filter((f) => f.ativo).length} ativo(s)</p>
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
              </Button>
            </div>

            {fluxos.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum fluxo criado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crie fluxos para automatizar o atendimento por intenção
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Criar Fluxo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {fluxos.map((f) => {
                  const int = intencaoConfig[f.intencao] || intencaoConfig.outro;
                  const IntIcon = int.icon;
                  return (
                    <Card key={f.id} className="border-border/50">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl bg-muted/50 ${int.color}`}>
                          <IntIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{f.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{int.label}</Badge>
                            {f.transferir_humano && (
                              <Badge variant="outline" className="text-[10px] text-warning">
                                <Users className="h-2.5 w-2.5 mr-0.5" /> Transfere
                              </Badge>
                            )}
                          </div>
                          {f.mensagem_inicial && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{f.mensagem_inicial}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={f.ativo}
                            onCheckedChange={(v) => toggleFluxo.mutate({ id: f.id, ativo: v })}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteFluxo.mutate(f.id)}
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
          </>
        )}

        {tab === "conversas" && (
          <>
            {conversas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma conversa</h3>
                  <p className="text-sm text-muted-foreground">
                    As conversas aparecerão aqui conforme forem recebidas
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {conversas.map((c) => (
                  <Card key={c.id} className="border-border/50">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-muted/50">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{c.nome_contato || c.telefone || "Contato"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] ${statusConversaColors[c.status] || ""}`}>
                            {c.status}
                          </Badge>
                          {c.intencao_detectada && (
                            <span className="text-xs text-muted-foreground capitalize">{c.intencao_detectada}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{c.plataforma}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Fluxo de Atendimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome do Fluxo</label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Pedido Rápido"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Intenção</label>
                <Select value={form.intencao} onValueChange={(v) => setForm((f) => ({ ...f, intencao: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(intencaoConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Mensagem Inicial (opcional)</label>
                <Textarea
                  value={form.mensagem_inicial}
                  onChange={(e) => setForm((f) => ({ ...f, mensagem_inicial: e.target.value }))}
                  placeholder="Mensagem que o bot envia ao detectar essa intenção..."
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Transferir para humano?</label>
                <Switch
                  checked={form.transferir_humano}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, transferir_humano: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addFluxo.mutate()} disabled={!form.nome || addFluxo.isPending}>
                Criar Fluxo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
