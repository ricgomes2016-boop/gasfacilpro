import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, Copy, Sparkles, Calendar, Image as ImageIcon, MessageSquare,
  Instagram, Facebook, Send, Video, RefreshCw, Download, Webhook, Phone,
  Film, Save, CalendarPlus, Upload,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ai`;
const DISPATCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-dispatch`;

type Platform = "instagram" | "facebook" | "tiktok" | "whatsapp";
type Tone = "profissional" | "informal" | "promocional";
type VideoPlatform = "reels" | "tiktok" | "shorts";

const platformConfig: Record<Platform, { label: string; icon: React.ElementType }> = {
  instagram: { label: "Instagram", icon: Instagram },
  facebook: { label: "Facebook", icon: Facebook },
  tiktok: { label: "TikTok", icon: Video },
  whatsapp: { label: "WhatsApp", icon: Send },
};

const toneConfig: Record<Tone, { label: string; emoji: string }> = {
  profissional: { label: "Profissional", emoji: "👔" },
  informal: { label: "Informal", emoji: "😎" },
  promocional: { label: "Promocional", emoji: "🔥" },
};

const videoPlatformConfig: Record<VideoPlatform, { label: string; emoji: string }> = {
  reels: { label: "Reels", emoji: "📸" },
  tiktok: { label: "TikTok", emoji: "🎵" },
  shorts: { label: "Shorts", emoji: "▶️" },
};

const topicCategories: { label: string; emoji: string; topics: string[] }[] = [
  {
    label: "Promoções",
    emoji: "🔥",
    topics: [
      "Promoção de gás P13 para o fim de semana",
      "Combo gás P13 + galão de água 20L com desconto",
      "Desconto especial para a primeira compra",
      "Compre 1 botijão e ganhe recarga de água",
      "Promoção relâmpago: troca de gás com R$ 5 OFF",
    ],
  },
  {
    label: "Datas comemorativas",
    emoji: "📅",
    topics: [
      "Dia das Mães: chame a mãe da casa",
      "Festa Junina: gás para a fogueira e quentão",
      "Dia do Cliente (15/09) — agradecimento especial",
      "Black Friday do gás: melhor preço do ano",
      "Natal e Ano Novo: ceia sem ficar sem gás",
      "Inverno chegando: estoque seu gás antes do frio",
    ],
  },
  {
    label: "Educacional / segurança",
    emoji: "🛡️",
    topics: [
      "Dicas de segurança com botijão de gás",
      "Como identificar vazamento de gás",
      "Validade e durabilidade do botijão P13",
      "Como economizar gás na cozinha",
      "Por que comprar gás de revenda autorizada",
    ],
  },
  {
    label: "Diferenciais",
    emoji: "🚚",
    topics: [
      "Entrega em até 20 minutos na sua casa",
      "Atendimento 24h pelo WhatsApp",
      "Pague no PIX, cartão ou na entrega",
      "Baixe nosso app e peça em 1 clique",
      "Cobertura de bairros: atendemos toda a região",
    ],
  },
  {
    label: "Fidelidade",
    emoji: "💚",
    topics: [
      "Programa de pontos: cada compra vira desconto",
      "Indique um amigo e ganhe vale-gás",
      "Cashback em todas as compras",
      "Vale-gás digital: presenteie quem você ama",
      "Clube do cliente: vantagens exclusivas",
    ],
  },
];

const suggestedTopics = topicCategories.flatMap((c) => c.topics);

// Sugestões "para hoje" rotativas por mês
const monthlyIdeas: Record<number, { topic: string; tone: Tone; platform: Platform; emoji: string }[]> = {
  0: [{ emoji: "🎆", topic: "Comece o ano com gás cheio em casa", tone: "promocional", platform: "instagram" }],
  1: [{ emoji: "🎭", topic: "Carnaval: não fique sem gás na folia", tone: "informal", platform: "instagram" }],
  2: [{ emoji: "👩", topic: "Dia Internacional da Mulher: homenagem às clientes", tone: "profissional", platform: "facebook" }],
  3: [{ emoji: "🐰", topic: "Páscoa: chocolate quente combina com gás cheio", tone: "informal", platform: "instagram" }],
  4: [{ emoji: "💐", topic: "Dia das Mães: presenteie com vale-gás", tone: "promocional", platform: "whatsapp" }],
  5: [
    { emoji: "🔥", topic: "Festa Junina: gás para o quentão e fogueira", tone: "informal", platform: "instagram" },
    { emoji: "❄️", topic: "Inverno chegando: garanta seu gás antes do frio", tone: "promocional", platform: "facebook" },
  ],
  6: [{ emoji: "❄️", topic: "Inverno: banho quente todo dia sem ficar sem gás", tone: "promocional", platform: "instagram" }],
  7: [{ emoji: "🧒", topic: "Dia dos Pais: vale-gás como presente útil", tone: "promocional", platform: "whatsapp" }],
  8: [{ emoji: "🎉", topic: "Dia do Cliente (15/09): desconto especial", tone: "promocional", platform: "instagram" }],
  9: [{ emoji: "🎃", topic: "Outubro: prepare a cozinha para as festas de fim de ano", tone: "informal", platform: "tiktok" }],
  10: [{ emoji: "🛒", topic: "Black Friday do gás: melhor preço do ano", tone: "promocional", platform: "instagram" }],
  11: [{ emoji: "🎄", topic: "Ceia de Natal sem perrengue: gás garantido", tone: "promocional", platform: "whatsapp" }],
};


export default function MarketingIA() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [searchParams] = useSearchParams();

  const brandContext = useMemo(() => ({
    brandName: unidadeAtual?.nome || (empresa as any)?.nome || "",
    cidade: unidadeAtual?.cidade || "",
    whatsapp: unidadeAtual?.telefone || "",
    instagram: "",
    empresa_id: empresaId,
    unidade_id: unidadeAtual?.id,
  }), [empresa, unidadeAtual, empresaId]);

  // Post state
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [tone, setTone] = useState<Tone>("profissional");
  const [topic, setTopic] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Aplicar query params (vindos do Dashboard "Sugestões")
  useEffect(() => {
    const t = searchParams.get("topic");
    const to = searchParams.get("tone") as Tone | null;
    const p = searchParams.get("platform") as Platform | null;
    if (t) setTopic(t);
    if (to && toneConfig[to]) setTone(to);
    if (p && platformConfig[p]) setPlatform(p);
  }, [searchParams]);


  // Image state
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Video state
  const [videoPlatform, setVideoPlatform] = useState<VideoPlatform>("reels");
  const [videoTopic, setVideoTopic] = useState("");
  const [videoTone, setVideoTone] = useState<Tone>("profissional");
  const [videoContent, setVideoContent] = useState("");
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [loadingSceneImages, setLoadingSceneImages] = useState<Record<number, boolean>>({});

  // Calendar state
  const [calendarContent, setCalendarContent] = useState("");
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  // Dispatch state
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
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
        } catch { /* partial json */ }
      }
    }
    onDone();
  }, []);

  const generatePost = async () => {
    if (!topic.trim()) { toast.error("Digite um tema"); return; }
    setIsLoading(true); setGeneratedContent("");
    let acc = "";
    try {
      await streamContent({ type: "post", platform, topic, tone, ...brandContext }, (c) => { acc += c; setGeneratedContent(acc); }, () => setIsLoading(false));
    } catch (e: any) { toast.error(e.message); setIsLoading(false); }
  };

  const parseScenes = (script: string) => {
    const scenes: { num: number; visual: string }[] = [];
    const regex = /\*\*Cena\s+(\d+)/gi;
    let match;
    while ((match = regex.exec(script)) !== null) {
      const num = parseInt(match[1]);
      const start = match.index;
      const nextMatch = regex.exec(script);
      const end = nextMatch ? nextMatch.index : script.length;
      if (nextMatch) regex.lastIndex = nextMatch.index;
      const block = script.slice(start, end);
      const visualMatch = block.match(/🎬\s*(?:Ação visual|Visual)[:\s]*(.+)/i);
      const visual = visualMatch?.[1]?.trim() || `Cena ${num} de vídeo sobre ${videoTopic}`;
      scenes.push({ num, visual });
    }
    return scenes;
  };

  const generateSceneImage = async (sceneNum: number, prompt: string) => {
    setLoadingSceneImages(prev => ({ ...prev, [sceneNum]: true }));
    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "image", imagePrompt: `Imagem para vídeo de marketing de revenda de gás. Cena: ${prompt}. Estilo: fotografia profissional, formato vertical 9:16, cores vibrantes, adequado para Reels/TikTok.` }),
      });
      if (!resp.ok) throw new Error("Erro ao gerar imagem");
      const data = await resp.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imgUrl) setSceneImages(prev => ({ ...prev, [sceneNum]: imgUrl }));
    } catch { /* silently fail per scene */ }
    finally { setLoadingSceneImages(prev => ({ ...prev, [sceneNum]: false })); }
  };

  const generateVideo = async () => {
    if (!videoTopic.trim()) { toast.error("Digite um tema para o vídeo"); return; }
    setIsVideoLoading(true); setVideoContent(""); setSceneImages({}); setLoadingSceneImages({});
    let acc = "";
    try {
      await streamContent(
        { type: "video_script", platform: videoPlatform, topic: videoTopic, tone: videoTone },
        (c) => { acc += c; setVideoContent(acc); },
        () => {
          setIsVideoLoading(false);
          // Auto-generate images for each scene
          const scenes = parseScenes(acc);
          if (scenes.length > 0) {
            toast.info(`Gerando imagens para ${scenes.length} cenas...`);
            scenes.forEach(s => generateSceneImage(s.num, s.visual));
          }
        }
      );
    } catch (e: any) { toast.error(e.message); setIsVideoLoading(false); }
  };

  const generateCalendar = async () => {
    setIsCalendarLoading(true); setCalendarContent("");
    let acc = "";
    try {
      await streamContent({ type: "calendar" }, (c) => { acc += c; setCalendarContent(acc); }, () => setIsCalendarLoading(false));
    } catch (e: any) { toast.error(e.message); setIsCalendarLoading(false); }
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) { toast.error("Descreva a imagem"); return; }
    setIsImageLoading(true); setGeneratedImage("");
    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "image", imagePrompt: `Crie uma imagem profissional para marketing de revenda de gás: ${imagePrompt}. Estilo: moderno, cores vibrantes, adequado para redes sociais.` }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Erro" })); throw new Error(err.error || `Erro ${resp.status}`); }
      const data = await resp.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imgUrl) { setGeneratedImage(imgUrl); toast.success("Imagem gerada!"); }
      else toast.error("Não foi possível gerar a imagem");
    } catch (e: any) { toast.error(e.message); }
    finally { setIsImageLoading(false); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const downloadImage = async (url: string) => {
    try {
      const resp = await fetch(url); const blob = await resp.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `marketing-gasfacil-${Date.now()}.png`; a.click(); URL.revokeObjectURL(a.href);
      toast.success("Imagem baixada!");
    } catch { window.open(url, "_blank"); }
  };

  const saveToLibrary = async (content: string, tipo: string) => {
    if (!empresaId) { toast.error("Empresa não encontrada"); return; }
    try {
      const { error } = await supabase.from("marketing_conteudos").insert({
        empresa_id: empresaId, unidade_id: unidadeAtual?.id || null,
        titulo: content.slice(0, 60), conteudo: content, tipo, plataforma: platform,
      });
      if (error) throw error;
      toast.success("Salvo na biblioteca!");
    } catch { toast.error("Erro ao salvar"); }
  };

  const openWhatsappDialog = (content: string, image?: string) => { setDispatchContent(content); setDispatchImage(image || ""); setWhatsappDialogOpen(true); };
  const openWebhookDialog = (content: string, image?: string) => { setDispatchContent(content); setDispatchImage(image || ""); setWebhookDialogOpen(true); };

  const sendWhatsApp = async () => {
    if (!whatsappPhone.trim()) { toast.error("Digite o telefone"); return; }
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(DISPATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "whatsapp", content: dispatchContent, phone: whatsappPhone, imageUrl: dispatchImage || undefined, unidadeId: unidadeAtual?.id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success("Enviado via WhatsApp!"); setWhatsappDialogOpen(false); setWhatsappPhone("");
    } catch (e: any) { toast.error(e.message || "Erro ao enviar"); }
    finally { setIsSending(false); }
  };

  const sendWebhook = async () => {
    if (!webhookUrl.trim()) { toast.error("Cole a URL do webhook"); return; }
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(DISPATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "webhook", content: dispatchContent, imageUrl: dispatchImage || undefined, webhookUrl, platform }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success("Enviado para o webhook!"); setWebhookDialogOpen(false);
    } catch (e: any) { toast.error(e.message || "Erro ao enviar"); }
    finally { setIsSending(false); }
  };

  const ActionButtons = ({ content, image, tipo = "texto" }: { content: string; image?: string; tipo?: string }) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => copyToClipboard(content)} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Copiar</Button>
      <Button size="sm" variant="outline" onClick={() => saveToLibrary(content, tipo)} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Salvar</Button>
      {image && <Button size="sm" variant="outline" onClick={() => downloadImage(image)} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Baixar</Button>}
      <Button size="sm" variant="outline" onClick={() => openWhatsappDialog(content, image)} className="gap-1.5 text-success"><Phone className="h-3.5 w-3.5" /> WhatsApp</Button>
      <Button size="sm" variant="outline" onClick={() => openWebhookDialog(content, image)} className="gap-1.5 text-purple-600"><Webhook className="h-3.5 w-3.5" /> Zapier/n8n</Button>
    </div>
  );

  const ToneSelector = ({ value, onChange }: { value: Tone; onChange: (v: Tone) => void }) => (
    <div>
      <label className="text-sm font-medium mb-2 block">Tom</label>
      <div className="flex gap-2">
        {(Object.entries(toneConfig) as [Tone, { label: string; emoji: string }][]).map(([key, cfg]) => (
          <button key={key} onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${value === key ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40"}`}>
            {cfg.emoji} {cfg.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Criar Conteúdo" subtitle="Gere posts, imagens, roteiros de vídeo e campanhas com IA" />
      <div className="space-y-4 p-4 md:p-6">
        <Tabs defaultValue="posts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="posts" className="gap-1.5 text-xs sm:text-sm"><MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">Post</span></TabsTrigger>
            <TabsTrigger value="image" className="gap-1.5 text-xs sm:text-sm"><ImageIcon className="h-4 w-4" /> <span className="hidden sm:inline">Imagem</span></TabsTrigger>
            <TabsTrigger value="video" className="gap-1.5 text-xs sm:text-sm"><Film className="h-4 w-4" /> <span className="hidden sm:inline">Vídeo</span></TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm"><Calendar className="h-4 w-4" /> <span className="hidden sm:inline">Calendário</span></TabsTrigger>
          </TabsList>

          {/* ═══ POST ═══ */}
          <TabsContent value="posts" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Plataforma</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.entries(platformConfig) as [Platform, typeof platformConfig[Platform]][]).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button key={key} onClick={() => setPlatform(key)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${platform === key ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>
                          <Icon className="h-4 w-4" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <ToneSelector value={tone} onChange={setTone} />
                <div>
                  <label className="text-sm font-medium mb-2 block">Tema do post</label>
                  <Textarea placeholder="Ex: Promoção de gás P13 para o fim de semana" value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTopics.map((t) => (
                    <Badge key={t} variant="outline" className="cursor-pointer hover:bg-primary/10 text-xs" onClick={() => setTopic(t)}>{t}</Badge>
                  ))}
                </div>
                <Button onClick={generatePost} disabled={isLoading} className="w-full gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isLoading ? "Gerando..." : "Gerar Post"}
                </Button>
              </CardContent>
            </Card>
            {generatedContent && (
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Resultado</CardTitle>
                  <Button size="sm" variant="outline" onClick={generatePost} disabled={isLoading}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4"><ReactMarkdown>{generatedContent}</ReactMarkdown></div>
                  <ActionButtons content={generatedContent} tipo="texto" />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ IMAGEM ═══ */}
          <TabsContent value="image" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Descreva a imagem</label>
                  <Textarea placeholder="Ex: Banner promoção gás P13 com fundo azul" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} rows={4} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Banner promoção gás P13", "Post boas-vindas clientes", "Imagem entrega rápida", "Dicas de segurança com gás"].map((s) => (
                    <Badge key={s} variant="outline" className="cursor-pointer hover:bg-primary/10 text-xs" onClick={() => setImagePrompt(s)}>{s}</Badge>
                  ))}
                </div>
                <Button onClick={generateImage} disabled={isImageLoading} className="w-full gap-2">
                  {isImageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {isImageLoading ? "Gerando..." : "Gerar Imagem"}
                </Button>
              </CardContent>
            </Card>
            {generatedImage && (
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Imagem Gerada</CardTitle>
                  <Button size="sm" variant="outline" onClick={generateImage} disabled={isImageLoading}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <img src={generatedImage} alt="Marketing" className="w-full rounded-lg border" />
                  <ActionButtons content={imagePrompt} image={generatedImage} tipo="imagem" />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ VÍDEO/ROTEIRO ═══ */}
          <TabsContent value="video" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Plataforma do Vídeo</label>
                  <div className="flex gap-2">
                    {(Object.entries(videoPlatformConfig) as [VideoPlatform, { label: string; emoji: string }][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setVideoPlatform(key)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${videoPlatform === key ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>
                        {cfg.emoji} {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ToneSelector value={videoTone} onChange={setVideoTone} />
                <div>
                  <label className="text-sm font-medium mb-2 block">Tema do vídeo</label>
                  <Textarea placeholder="Ex: Mostrar a rapidez da entrega de gás na nossa região" value={videoTopic} onChange={(e) => setVideoTopic(e.target.value)} rows={3} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Promoção relâmpago de gás", "Bastidores da entrega", "Dica de segurança rápida", "Depoimento de cliente satisfeito"].map((s) => (
                    <Badge key={s} variant="outline" className="cursor-pointer hover:bg-primary/10 text-xs" onClick={() => setVideoTopic(s)}>{s}</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={generateVideo} disabled={isVideoLoading} className="flex-1 gap-2">
                    {isVideoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                    {isVideoLoading ? "Gerando roteiro + imagens..." : "Gerar Roteiro + Imagens"}
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      id="video-upload-input"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        e.target.value = "";
                        const maxSize = 50 * 1024 * 1024;
                        for (const file of Array.from(files)) {
                          if (file.size > maxSize) {
                            toast.error(`"${file.name}" excede 50MB`);
                            continue;
                          }
                          try {
                            const ext = file.name.split(".").pop() || "mp4";
                            const path = `videos/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                            const { error } = await supabase.storage.from("marketing-assets").upload(path, file, { cacheControl: "3600" });
                            if (error) throw error;
                            const { data: urlData } = supabase.storage.from("marketing-assets").getPublicUrl(path);
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user && empresaId) {
                              await supabase.from("marketing_conteudos").insert({
                                empresa_id: empresaId,
                                unidade_id: unidadeAtual?.id || null,
                                tipo: "video",
                                titulo: file.name.replace(/\.[^.]+$/, ""),
                                conteudo: urlData.publicUrl,
                                plataforma: videoPlatform,
                              });
                            }
                            toast.success(`"${file.name}" importado!`);
                          } catch (err: any) {
                            console.error("Erro upload vídeo:", err);
                            toast.error(`Erro ao importar "${file.name}"`);
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => document.getElementById("video-upload-input")?.click()}
                    >
                      <Upload className="h-4 w-4" /> Importar Vídeo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            {videoContent && (
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Roteiro + Imagens Geradas</CardTitle>
                  <Button size="sm" variant="outline" onClick={generateVideo} disabled={isVideoLoading}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4"><ReactMarkdown>{videoContent}</ReactMarkdown></div>
                  
                  {/* Scene Images Grid */}
                  {(Object.keys(sceneImages).length > 0 || Object.values(loadingSceneImages).some(Boolean)) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Imagens das Cenas</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {parseScenes(videoContent).map(scene => (
                          <div key={scene.num} className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Cena {scene.num}</p>
                            {loadingSceneImages[scene.num] ? (
                              <div className="aspect-[9/16] rounded-lg bg-muted/50 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : sceneImages[scene.num] ? (
                              <div className="space-y-1">
                                <img src={sceneImages[scene.num]} alt={`Cena ${scene.num}`} className="w-full rounded-lg border" />
                                <Button size="sm" variant="ghost" className="w-full text-xs gap-1" onClick={() => downloadImage(sceneImages[scene.num])}>
                                  <Download className="h-3 w-3" /> Baixar
                                </Button>
                              </div>
                            ) : (
                              <div className="aspect-[9/16] rounded-lg bg-muted/30 border border-dashed flex items-center justify-center">
                                <Button size="sm" variant="ghost" className="text-xs" onClick={() => generateSceneImage(scene.num, scene.visual)}>
                                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> Gerar
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <ActionButtons content={videoContent} tipo="video" />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ CALENDÁRIO ═══ */}
          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Calendário de Marketing</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Datas e oportunidades para os próximos 60 dias</p>
                  </div>
                  <Button onClick={generateCalendar} disabled={isCalendarLoading} size="sm" className="gap-2">
                    {isCalendarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                    {isCalendarLoading ? "Gerando..." : "Gerar"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {calendarContent ? (
                  <>
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4"><ReactMarkdown>{calendarContent}</ReactMarkdown></div>
                    <ActionButtons content={calendarContent} tipo="texto" />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground min-h-[150px] gap-2">
                    <Calendar className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Clique em "Gerar" para ver as próximas oportunidades</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* WhatsApp Dialog */}
        <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-success" /> Enviar via WhatsApp</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">{dispatchContent.slice(0, 200)}{dispatchContent.length > 200 && "..."}</div>
              {dispatchImage && <img src={dispatchImage} alt="Preview" className="h-20 rounded border" />}
              <div className="space-y-2">
                <Label>Telefone (com DDD)</Label>
                <Input placeholder="11999998888" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
              </div>
              <Button onClick={sendWhatsApp} disabled={isSending} className="w-full gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? "Enviando..." : "Enviar WhatsApp"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Webhook Dialog */}
        <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-purple-600" /> Enviar via Webhook</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">{dispatchContent.slice(0, 200)}{dispatchContent.length > 200 && "..."}</div>
              <div className="space-y-2">
                <Label>URL do Webhook (Zapier/n8n)</Label>
                <Input placeholder="https://hooks.zapier.com/hooks/catch/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
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
