import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Calendar as CalendarIcon, Clock, Trash2, CheckCircle2, XCircle, AlertCircle,
  Sparkles, Loader2, Image as ImageIcon, X, List, LayoutGrid, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SeletorImagemGaleria } from "@/components/marketing/SeletorImagemGaleria";
import { PostPreview } from "@/components/marketing/PostPreview";
import { CalendarioPosts } from "@/components/marketing/CalendarioPosts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, AlertTriangle } from "lucide-react";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ai`;

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  agendado: { label: "Agendado", color: "bg-info/10 text-info", icon: Clock },
  publicado: { label: "Publicado", color: "bg-success/10 text-success", icon: CheckCircle2 },
  falhou: { label: "Falhou", color: "bg-destructive/10 text-destructive", icon: XCircle },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: AlertCircle },
};

const plataformaEmoji: Record<string, string> = {
  instagram: "📸", facebook: "📘", tiktok: "🎵", youtube: "▶️", whatsapp: "💬",
};

export default function AgendamentoPosts() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seletorOpen, setSeletorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [form, setForm] = useState({
    plataforma: "instagram",
    texto: "",
    midia_url: "",
    data_agendamento: "",
    hora: "10:00",
  });

  // Receber imagem/legenda/plataforma/data/hora via query param (vindas da Galeria ou Templates)
  useEffect(() => {
    const img = searchParams.get("imagem");
    const legenda = searchParams.get("legenda");
    const plat = searchParams.get("plataforma");
    const dataQ = searchParams.get("data");
    const horaQ = searchParams.get("hora");
    if (img || legenda || plat || dataQ || horaQ) {
      setForm((f) => ({
        ...f,
        midia_url: img || f.midia_url,
        texto: legenda || f.texto,
        plataforma: plat || f.plataforma,
        data_agendamento: dataQ || f.data_agendamento,
        hora: horaQ || f.hora,
      }));
      setDialogOpen(true);
      ["imagem", "legenda", "plataforma", "data", "hora"].forEach((k) => searchParams.delete(k));
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["mkt-agendamentos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_agendamentos").select("*").eq("empresa_id", empresaId!)
        .order("data_agendamento", { ascending: true });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: socialAccounts = [] } = useQuery({
    queryKey: ["mkt-social-accounts", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_accounts").select("id, plataforma, conectado_via, ativo")
        .eq("empresa_id", empresaId!).eq("ativo", true);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const contaPlataforma = socialAccounts.find((s: any) => s.plataforma === form.plataforma);
  const isOAuthAccount = contaPlataforma?.conectado_via === "oauth";

  const addMut = useMutation({
    mutationFn: async () => {
      const dataHora = `${form.data_agendamento}T${form.hora}:00`;
      const payload: any = {
        empresa_id: empresaId!, unidade_id: unidadeAtual?.id || null,
        plataforma: form.plataforma, texto: form.texto, data_agendamento: dataHora, status: "agendado",
      };
      if (form.midia_url) payload.midia_url = form.midia_url;
      const { error } = await supabase.from("marketing_agendamentos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-agendamentos"] });
      toast({ title: "Post agendado!" });
      setDialogOpen(false);
      setForm({ plataforma: "instagram", texto: "", midia_url: "", data_agendamento: "", hora: "10:00" });
    },
    onError: (e: any) => toast({ title: "Erro ao agendar", description: e.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => { await supabase.from("marketing_agendamentos").update({ status: "cancelado" }).eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-agendamentos"] }); toast({ title: "Cancelado" }); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await supabase.from("marketing_agendamentos").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-agendamentos"] }); toast({ title: "Removido" }); },
  });

  const generateWithAI = useCallback(async () => {
    setIsGenerating(true);
    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "post", platform: form.plataforma, topic: "Promoção especial do dia para clientes", tone: "promocional" }),
      });
      if (!resp.ok) throw new Error("Erro ao gerar");
      if (!resp.body) throw new Error("Sem resposta");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) result += c; } catch {}
        }
      }
      setForm((f) => ({ ...f, texto: result }));
      toast({ title: "Texto gerado pela IA!" });
    } catch (e: any) { toast({ title: e.message || "Erro ao gerar", variant: "destructive" }); }
    finally { setIsGenerating(false); }
  }, [form.plataforma]);

  return (
    <MainLayout>
      <Header title="Agendamento de Posts" subtitle="Agende publicações nas suas redes sociais" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{agendamentos.filter((a: any) => a.status === "agendado").length} agendado(s)</p>
          <Button onClick={() => setDialogOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Agendamento</Button>
        </div>

        <Tabs defaultValue="calendario" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendario" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5">
              <List className="h-4 w-4" /> Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendario">
            <Card className="border-border/50">
              <CardContent className="p-3 md:p-4">
                <CalendarioPosts agendamentos={agendamentos} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lista">
            {agendamentos.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum agendamento</h3>
                  <p className="text-sm text-muted-foreground mb-4">Agende seu primeiro post</p>
                  <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Agendar Post</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {agendamentos.map((ag: any) => {
                  const st = statusConfig[ag.status] || statusConfig.agendado;
                  const StIcon = st.icon;
                  return (
                    <Card key={ag.id} className="border-border/50">
                      <CardContent className="p-4 flex items-start gap-3">
                        {ag.midia_url ? (
                          <img src={ag.midia_url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="text-2xl mt-1">{plataformaEmoji[ag.plataforma] || "📝"}</div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium line-clamp-2">{ag.texto?.slice(0, 120) || "Post sem texto"}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className={`text-[10px] cursor-default ${st.color}`}>
                                    <StIcon className="h-3 w-3 mr-1" />{st.label}
                                  </Badge>
                                </TooltipTrigger>
                                {ag.status === "falhou" && ag.resultado_publicacao?.erro && (
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs"><strong>Erro:</strong> {ag.resultado_publicacao.erro}</p>
                                  </TooltipContent>
                                )}
                                {ag.status === "publicado" && ag.resultado_publicacao?.publicado_em && (
                                  <TooltipContent>
                                    <p className="text-xs">Publicado em {format(new Date(ag.resultado_publicacao.publicado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-xs text-muted-foreground capitalize">{plataformaEmoji[ag.plataforma]} {ag.plataforma}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(ag.data_agendamento), "dd/MM/yyyy · HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {ag.status === "agendado" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cancelMut.mutate(ag.id)}><XCircle className="h-4 w-4 text-warning" /></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(ag.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Agendamento</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-4 py-2">
              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Plataforma</label>
                  <Select value={form.plataforma} onValueChange={(v) => setForm((f) => ({ ...f, plataforma: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">📸 Instagram</SelectItem>
                      <SelectItem value="facebook">📘 Facebook</SelectItem>
                      <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                      <SelectItem value="youtube">▶️ YouTube</SelectItem>
                      <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                  {contaPlataforma ? (
                    isOAuthAccount ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-success/10 text-success dark:text-success border border-success/20">
                        <Zap className="h-3.5 w-3.5" />
                        <span>Será publicado automaticamente no horário agendado</span>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-warning/10 text-warning dark:text-warning border border-warning/20">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Apenas lembrete — você precisará publicar manualmente</span>
                      </div>
                    )
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Nenhuma conta cadastrada para esta plataforma. Cadastre em Marketing → Redes Sociais.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Imagem (opcional)</label>
                  {form.midia_url ? (
                    <div className="relative">
                      <img src={form.midia_url} alt="" className="w-full max-h-48 object-cover rounded-lg border border-border" />
                      <Button
                        variant="destructive" size="icon" className="absolute top-1.5 right-1.5 h-7 w-7"
                        onClick={() => setForm((f) => ({ ...f, midia_url: "" }))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setSeletorOpen(true)} className="w-full">
                      <ImageIcon className="h-4 w-4 mr-1.5" /> Escolher da Galeria
                    </Button>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium">Texto do Post</label>
                    <Button variant="ghost" size="sm" onClick={generateWithAI} disabled={isGenerating} className="gap-1.5 h-7 text-xs text-primary">
                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Gerar com IA
                    </Button>
                  </div>
                  <Textarea value={form.texto} onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))} placeholder="Digite ou gere com IA..." rows={5} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Data</label>
                    <Input type="date" value={form.data_agendamento} onChange={(e) => setForm((f) => ({ ...f, data_agendamento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Hora</label>
                    <Input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </label>
                <div className="bg-muted/30 rounded-lg p-3 sticky top-0">
                  <PostPreview plataforma={form.plataforma} imagemUrl={form.midia_url || null} texto={form.texto} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addMut.mutate()} disabled={!form.texto || !form.data_agendamento || addMut.isPending}>
                {addMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SeletorImagemGaleria
          open={seletorOpen}
          onOpenChange={setSeletorOpen}
          onSelect={(url) => setForm((f) => ({ ...f, midia_url: url }))}
        />
      </div>
    </MainLayout>
  );
}
