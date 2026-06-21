import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Search, FileText, Image as ImageIcon, Video, Star, StarOff, Trash2, Copy, CalendarPlus,
  Sparkles, Images, Link2, Eye, X, LayoutTemplate, Send, CheckCircle2, Clock4, FileEdit, Archive,
} from "lucide-react";
import { TemplatesBiblioteca } from "@/components/marketing/TemplatesBiblioteca";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GaleriaImagens } from "@/components/marketing/GaleriaImagens";
import { SeletorImagemGaleria } from "@/components/marketing/SeletorImagemGaleria";
import { PostPreview } from "@/components/marketing/PostPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tipoConfig: Record<string, { icon: any; label: string; color: string }> = {
  texto: { icon: FileText, label: "Texto", color: "bg-blue-500/10 text-blue-600" },
  imagem: { icon: ImageIcon, label: "Imagem", color: "bg-pink-500/10 text-pink-600" },
  video: { icon: Video, label: "Vídeo/Roteiro", color: "bg-violet-500/10 text-violet-600" },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-slate-500/10 text-slate-600 border-slate-500/30", icon: FileEdit },
  em_revisao: { label: "Em revisão", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock4 },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  agendado: { label: "Agendado", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: CalendarPlus },
  publicado: { label: "Publicado", color: "bg-violet-500/10 text-violet-600 border-violet-500/30", icon: Send },
  arquivado: { label: "Arquivado", color: "bg-muted text-muted-foreground border-border", icon: Archive },
};

const plataformaEmoji: Record<string, string> = {
  instagram: "📸", facebook: "📘", tiktok: "🎵", youtube: "▶️", whatsapp: "💬",
  reels: "📸", shorts: "▶️",
};

export default function BibliotecaConteudos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPlataforma, setFiltroPlataforma] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [seletorParaId, setSeletorParaId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  const { data: conteudos = [] } = useQuery({
    queryKey: ["mkt-conteudos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_conteudos").select("*").eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, favorito }: { id: string; favorito: boolean }) => {
      await supabase.from("marketing_conteudos").update({ favorito }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "aprovado") {
        const { data: { user } } = await supabase.auth.getUser();
        patch.aprovado_por = user?.id || null;
        patch.aprovado_em = new Date().toISOString();
      }
      const { error } = await supabase.from("marketing_conteudos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] });
      const lbl = (statusConfig as any)[v.status]?.label || v.status;
      toast({ title: `Status: ${lbl}` });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar status", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("marketing_conteudos").delete().eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] }); toast({ title: "Removido" }); },
  });

  const linkImagem = useMutation({
    mutationFn: async ({ id, midia_url }: { id: string; midia_url: string | null }) => {
      await supabase.from("marketing_conteudos").update({ midia_url }).eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] }); toast({ title: "Imagem atualizada" }); },
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copiado!" }); };

  const filtered = conteudos.filter((c: any) => {
    if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
    if (filtroPlataforma !== "todas" && c.plataforma !== filtroPlataforma) return false;
    if (filtroStatus !== "todos" && (c.status || "rascunho") !== filtroStatus) return false;
    if (busca) {
      const s = busca.toLowerCase();
      return c.titulo?.toLowerCase().includes(s) || c.conteudo?.toLowerCase().includes(s) || c.hashtags?.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <MainLayout>
      <Header title="Biblioteca de Marketing" subtitle="Conteúdos e imagens para suas redes sociais" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <Tabs defaultValue="conteudos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="conteudos" className="gap-1.5">
              <FileText className="h-4 w-4" /> Conteúdos
            </TabsTrigger>
            <TabsTrigger value="galeria" className="gap-1.5">
              <Images className="h-4 w-4" /> Galeria
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <LayoutTemplate className="h-4 w-4" /> Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conteudos" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="imagem">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Plataforma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer status</SelectItem>
                  {Object.entries(statusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => navigate("/clientes/marketing")} size="sm"><Sparkles className="h-4 w-4 mr-1" /> Criar</Button>
            </div>

            {filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum conteúdo</h3>
                  <p className="text-sm text-muted-foreground mb-4">Use "Criar Conteúdo" para gerar com IA</p>
                  <Button onClick={() => navigate("/clientes/marketing")}><Sparkles className="h-4 w-4 mr-1" /> Criar Conteúdo</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c: any) => {
                  const tc = tipoConfig[c.tipo] || tipoConfig.texto;
                  const TipoIcon = tc.icon;
                  const status = c.status || "rascunho";
                  const sc = statusConfig[status] || statusConfig.rascunho;
                  const SIcon = sc.icon;
                  return (
                    <Card key={c.id} className="border-border/50 overflow-hidden">
                      {c.midia_url && (
                        <div className="relative aspect-video bg-muted">
                          <img src={c.midia_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <Button
                            variant="destructive" size="icon" className="absolute top-1.5 right-1.5 h-6 w-6 opacity-80"
                            onClick={() => linkImagem.mutate({ id: c.id, midia_url: null })}
                            title="Remover imagem"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] gap-1 ${tc.color}`}>
                              <TipoIcon className="h-3 w-3" /> {tc.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] gap-1 ${sc.color}`}>
                              <SIcon className="h-3 w-3" /> {sc.label}
                            </Badge>
                            {c.plataforma && <span className="text-sm">{plataformaEmoji[c.plataforma] || ""}</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>
                        {c.titulo && <p className="font-medium text-sm line-clamp-2">{c.titulo}</p>}
                        {c.conteudo && <p className="text-sm text-muted-foreground line-clamp-4">{c.conteudo}</p>}
                        {c.hashtags && <p className="text-xs text-primary/70 truncate">{c.hashtags}</p>}

                        {/* Workflow editorial */}
                        <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-border/30">
                          {status === "rascunho" && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setStatus.mutate({ id: c.id, status: "em_revisao" })}>
                              <Clock4 className="h-3 w-3" /> Enviar p/ revisão
                            </Button>
                          )}
                          {status === "em_revisao" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-emerald-500/40 text-emerald-600" onClick={() => setStatus.mutate({ id: c.id, status: "aprovado" })}>
                                <CheckCircle2 className="h-3 w-3" /> Aprovar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setStatus.mutate({ id: c.id, status: "rascunho" })}>
                                Voltar
                              </Button>
                            </>
                          )}
                          {status === "aprovado" && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => navigate(c.midia_url ? `/marketing/agendamentos?imagem=${encodeURIComponent(c.midia_url)}` : "/marketing/agendamentos")}>
                              <CalendarPlus className="h-3 w-3" /> Agendar
                            </Button>
                          )}
                          {(status === "agendado" || status === "publicado") && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setStatus.mutate({ id: c.id, status: "arquivado" })}>
                              <Archive className="h-3 w-3 mr-1" /> Arquivar
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 pt-1 border-t border-border/30">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleFav.mutate({ id: c.id, favorito: !c.favorito })} title="Favoritar">
                            {c.favorito ? <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" /> : <StarOff className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => c.conteudo && copyToClipboard(c.conteudo)} title="Copiar texto">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSeletorParaId(c.id)} title="Vincular imagem">
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewItem(c)} title="Preview">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex-1" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(c.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>


          <TabsContent value="galeria">
            <GaleriaImagens />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesBiblioteca />
          </TabsContent>
        </Tabs>

        <SeletorImagemGaleria
          open={!!seletorParaId}
          onOpenChange={(v) => !v && setSeletorParaId(null)}
          onSelect={(url) => {
            if (seletorParaId) linkImagem.mutate({ id: seletorParaId, midia_url: url });
            setSeletorParaId(null);
          }}
        />

        <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreviewItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Preview do post</DialogTitle>
            </DialogHeader>
            {previewItem && (
              <div className="bg-muted/30 rounded-lg p-3">
                <PostPreview
                  plataforma={previewItem.plataforma || "instagram"}
                  imagemUrl={previewItem.midia_url}
                  texto={[previewItem.conteudo, previewItem.hashtags].filter(Boolean).join("\n\n")}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
