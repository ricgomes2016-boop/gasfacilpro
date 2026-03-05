import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy, Sparkles, Calendar, Image as ImageIcon, MessageSquare, Instagram, Facebook, Send, Video, RefreshCw, Download, Share2, Webhook, Phone } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ai`;
const DISPATCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-dispatch`;

type Platform = "instagram" | "facebook" | "tiktok" | "whatsapp";

const platformConfig: Record<Platform, { label: string; icon: React.ElementType; color: string }> = {
  instagram: { label: "Instagram", icon: Instagram, color: "bg-pink-500/10 text-pink-600" },
  facebook: { label: "Facebook", icon: Facebook, color: "bg-blue-500/10 text-blue-600" },
  tiktok: { label: "TikTok", icon: Video, color: "bg-foreground/10 text-foreground" },
  whatsapp: { label: "WhatsApp", icon: Send, color: "bg-green-500/10 text-green-600" },
};

const suggestedTopics = [
  "Promoção de gás P13 para o fim de semana",
  "Entrega rápida e segura em toda a cidade",
  "Dicas de segurança com botijão de gás",
  "Promoção para novos clientes",
  "Programa de fidelidade e indicação",
  "Atendimento 24h por WhatsApp",
];

export default function MarketingIA() {
  const { unidadeAtual } = useUnidade();
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [topic, setTopic] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [calendarContent, setCalendarContent] = useState("");
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Dispatch states
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [dispatchContent, setDispatchContent] = useState("");
  const [dispatchImage, setDispatchImage] = useState("");

  const streamContent = useCallback(async (body: Record<string, unknown>, onDelta: (t: string) => void, onDone: () => void) => {
    const resp = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `Erro ${resp.status}`);
    }

    if (!resp.body) throw new Error("Sem resposta do servidor");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* partial json, skip */ }
      }
    }
    onDone();
  }, []);

  const generatePost = async () => {
    if (!topic.trim()) { toast.error("Digite um tema para o post"); return; }
    setIsLoading(true);
    setGeneratedContent("");
    let acc = "";
    try {
      await streamContent(
        { type: "post", platform, topic, tone: "profissional" },
        (chunk) => { acc += chunk; setGeneratedContent(acc); },
        () => setIsLoading(false),
      );
    } catch (e: any) {
      toast.error(e.message);
      setIsLoading(false);
    }
  };

  const generateCalendar = async () => {
    setIsCalendarLoading(true);
    setCalendarContent("");
    let acc = "";
    try {
      await streamContent(
        { type: "calendar" },
        (chunk) => { acc += chunk; setCalendarContent(acc); },
        () => setIsCalendarLoading(false),
      );
    } catch (e: any) {
      toast.error(e.message);
      setIsCalendarLoading(false);
    }
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) { toast.error("Descreva a imagem que deseja criar"); return; }
    setIsImageLoading(true);
    setGeneratedImage("");
    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ type: "image", imagePrompt: `Crie uma imagem profissional para marketing de revenda de gás: ${imagePrompt}. Estilo: moderno, cores vibrantes, adequado para redes sociais.` }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imgUrl) {
        setGeneratedImage(imgUrl);
        toast.success("Imagem gerada com sucesso!");
      } else {
        toast.error("Não foi possível gerar a imagem");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsImageLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const downloadImage = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `marketing-gasfacil-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Imagem baixada!");
    } catch {
      window.open(url, "_blank");
    }
  };

  const openWhatsappDialog = (content: string, image?: string) => {
    setDispatchContent(content);
    setDispatchImage(image || "");
    setWhatsappDialogOpen(true);
  };

  const openWebhookDialog = (content: string, image?: string) => {
    setDispatchContent(content);
    setDispatchImage(image || "");
    setWebhookDialogOpen(true);
  };

  const sendWhatsApp = async () => {
    if (!whatsappPhone.trim()) { toast.error("Digite o telefone"); return; }
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(DISPATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "whatsapp",
          content: dispatchContent,
          phone: whatsappPhone,
          imageUrl: dispatchImage || undefined,
          unidadeId: unidadeAtual?.id,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success("Enviado via WhatsApp!");
      setWhatsappDialogOpen(false);
      setWhatsappPhone("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setIsSending(false);
    }
  };

  const sendWebhook = async () => {
    if (!webhookUrl.trim()) { toast.error("Cole a URL do webhook"); return; }
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(DISPATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "webhook",
          content: dispatchContent,
          imageUrl: dispatchImage || undefined,
          webhookUrl,
          platform,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success("Enviado para o webhook!");
      setWebhookDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setIsSending(false);
    }
  };

  const ActionButtons = ({ content, image }: { content: string; image?: string }) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => copyToClipboard(content)} className="gap-1.5">
        <Copy className="h-3.5 w-3.5" /> Copiar
      </Button>
      {image && (
        <Button size="sm" variant="outline" onClick={() => downloadImage(image)} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Baixar Imagem
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => openWhatsappDialog(content, image)} className="gap-1.5 text-green-600 hover:text-green-700">
        <Phone className="h-3.5 w-3.5" /> WhatsApp
      </Button>
      <Button size="sm" variant="outline" onClick={() => openWebhookDialog(content, image)} className="gap-1.5 text-purple-600 hover:text-purple-700">
        <Webhook className="h-3.5 w-3.5" /> Zapier/n8n
      </Button>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Marketing com IA" subtitle="Crie conteúdo e publique nas redes sociais" />
      <div className="space-y-6 p-4 md:p-6">

        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="posts" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Posts
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-2">
              <ImageIcon className="h-4 w-4" /> Imagens
            </TabsTrigger>
          </TabsList>

          {/* === POSTS TAB === */}
          <TabsContent value="posts" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Criar Post</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Plataforma</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.entries(platformConfig) as [Platform, typeof platformConfig[Platform]][]).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setPlatform(key)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                              platform === key
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Tema do post</label>
                    <Textarea
                      placeholder="Ex: Promoção de gás P13 para o fim de semana com entrega grátis"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Sugestões rápidas</label>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTopics.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => setTopic(t)}
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button onClick={generatePost} disabled={isLoading} className="w-full gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isLoading ? "Gerando..." : "Gerar Post"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Resultado</CardTitle>
                  {generatedContent && (
                    <Button size="sm" variant="outline" onClick={generatePost} disabled={isLoading} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Refazer
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {generatedContent ? (
                    <>
                      <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4 min-h-[200px]">
                        <ReactMarkdown>{generatedContent}</ReactMarkdown>
                      </div>
                      <ActionButtons content={generatedContent} />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground min-h-[200px] gap-2">
                      <Sparkles className="h-8 w-8 opacity-30" />
                      <p className="text-sm">O conteúdo gerado aparecerá aqui</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === CALENDAR TAB === */}
          <TabsContent value="calendar" className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Calendário de Marketing</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Datas comemorativas e oportunidades para os próximos 60 dias</p>
                </div>
                <Button onClick={generateCalendar} disabled={isCalendarLoading} className="gap-2">
                  {isCalendarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  {isCalendarLoading ? "Gerando..." : "Gerar Calendário"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {calendarContent ? (
                  <>
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4">
                      <ReactMarkdown>{calendarContent}</ReactMarkdown>
                    </div>
                    <ActionButtons content={calendarContent} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground min-h-[200px] gap-2">
                    <Calendar className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Clique em "Gerar Calendário" para ver as próximas oportunidades</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === IMAGE TAB === */}
          <TabsContent value="image" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Criar Imagem</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Descreva a imagem</label>
                    <Textarea
                      placeholder="Ex: Banner promocional de gás P13 com fundo azul, chama dourada e texto 'Promoção de Inverno'"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Banner promoção gás P13",
                      "Post de boas-vindas para novos clientes",
                      "Imagem de entrega rápida",
                      "Dicas de segurança com gás",
                    ].map((s) => (
                      <Badge key={s} variant="outline" className="cursor-pointer hover:bg-primary/10" onClick={() => setImagePrompt(s)}>
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <Button onClick={generateImage} disabled={isImageLoading} className="w-full gap-2">
                    {isImageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {isImageLoading ? "Gerando imagem..." : "Gerar Imagem"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Imagem Gerada</CardTitle>
                  {generatedImage && (
                    <Button size="sm" variant="outline" onClick={generateImage} disabled={isImageLoading} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Refazer
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {generatedImage ? (
                    <div className="space-y-3">
                      <img
                        src={generatedImage}
                        alt="Imagem gerada por IA para marketing"
                        className="w-full rounded-lg border"
                      />
                      <ActionButtons content={imagePrompt} image={generatedImage} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground min-h-[250px] gap-2">
                      <ImageIcon className="h-8 w-8 opacity-30" />
                      <p className="text-sm">A imagem gerada aparecerá aqui</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* === WhatsApp Dialog === */}
        <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-green-600" /> Enviar via WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">
                {dispatchContent.slice(0, 200)}{dispatchContent.length > 200 && "..."}
              </div>
              {dispatchImage && (
                <img src={dispatchImage} alt="Preview" className="h-20 rounded border" />
              )}
              <div className="space-y-2">
                <Label>Telefone (com DDD)</Label>
                <Input
                  placeholder="11999998888"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Apenas números. Ex: 11999998888</p>
              </div>
              <Button onClick={sendWhatsApp} disabled={isSending} className="w-full gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? "Enviando..." : "Enviar WhatsApp"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* === Webhook Dialog === */}
        <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-purple-600" /> Enviar via Webhook
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">
                {dispatchContent.slice(0, 200)}{dispatchContent.length > 200 && "..."}
              </div>
              <div className="space-y-2">
                <Label>URL do Webhook (Zapier/n8n)</Label>
                <Input
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Cole a URL do webhook do Zapier ou n8n. O conteúdo será enviado como JSON com os campos: content, imageUrl, platform, timestamp.
                </p>
              </div>
              <Button onClick={sendWebhook} disabled={isSending} className="w-full gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
                {isSending ? "Enviando..." : "Enviar para Webhook"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
