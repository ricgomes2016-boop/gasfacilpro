import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Send, Sparkles, User, Lightbulb, ArrowLeft, Check, CheckCheck, Building2, Search, X } from "lucide-react";
import { VoiceInputButton } from "@/components/ai/VoiceButton";
import { supabase } from "@/integrations/supabase/client";
import { useChatNotification } from "@/hooks/useChatNotification";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMsg {
  id: string;
  remetente_id: string;
  destinatario_id: string | null;
  mensagem: string;
  created_at: string;
  lida: boolean;
  remetente_nome?: string | null;
}

interface Peer {
  id: string;
  nome: string;
  telefone?: string | null;
  tipo: "entregador" | "base";
}

interface PeerWithPreview extends Peer {
  lastMessage: string;
  lastMessageTime: string;
}

const SUGESTOES = [
  "Lança 1 gás na rua Central, 50",
  "Quanto tem de P13?",
  "Transfira 10 gás pra Matriz",
  "Meus pedidos de hoje",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/entregador-chat-ia`;

// Avatar color palette
const AVATAR_COLORS = [
  "bg-success", "bg-info", "bg-primary", "bg-warning",
  "bg-primary", "bg-success", "bg-info", "bg-destructive",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatMessageTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM", { locale: ptBR });
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function getDateKey(dateStr: string) {
  return format(new Date(dateStr), "yyyy-MM-dd");
}

export function ChatBase() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("ia");
  const { notify } = useChatNotification();

  // IA state
  const [aiMessages, setAiMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! 👋 Sou seu assistente de entregas. Pode me dar comandos por voz ou texto:\n\n• **\"Lança 1 gás na rua X, 20\"** → crio o pedido\n• **\"Transfira 20 gás pra filial Y\"** → faço a transferência\n• **\"Quanto tem de P13?\"** → consulto estoque",
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Conversas state
  const [peers, setPeers] = useState<PeerWithPreview[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Init entregador info
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data } = await supabase
        .from("entregadores")
        .select("id, unidade_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setEntregadorId(data.id);
        setUnidadeId(data.unidade_id);
      }
    };
    init();
  }, [user]);

  // Load peers list with last message preview
  const loadPeers = useCallback(async () => {
    if (!unidadeId || !entregadorId) return;

    // Load other entregadores
    const { data: entregadores } = await supabase
      .from("entregadores")
      .select("id, nome, telefone")
      .eq("unidade_id", unidadeId)
      .neq("id", entregadorId)
      .eq("ativo", true);

    // Get unidade name for "Base" label
    const { data: unidade } = await supabase
      .from("unidades")
      .select("nome")
      .eq("id", unidadeId)
      .maybeSingle();

    const basePeer: Peer = {
      id: `base-${unidadeId}`,
      nome: `Base ${unidade?.nome || ""}`.trim(),
      tipo: "base",
    };

    const allPeers: Peer[] = [
      basePeer,
      ...(entregadores || []).map((e) => ({
        id: e.id,
        nome: e.nome,
        telefone: e.telefone,
        tipo: "entregador" as const,
      })),
    ];

    // Fetch last message for each peer in parallel
    const peersWithPreview = await Promise.all(
      allPeers.map(async (p) => {
        let query;
        if (p.tipo === "base") {
          query = supabase
            .from("chat_mensagens")
            .select("mensagem, created_at")
            .or(
              `and(remetente_id.eq.${entregadorId},destinatario_tipo.eq.base,destinatario_id.eq.${unidadeId}),and(destinatario_id.eq.${entregadorId},remetente_tipo.eq.base)`
            )
            .order("created_at", { ascending: false })
            .limit(1);
        } else {
          query = supabase
            .from("chat_mensagens")
            .select("mensagem, created_at")
            .eq("remetente_tipo", "entregador")
            .eq("destinatario_tipo", "entregador")
            .or(
              `and(remetente_id.eq.${entregadorId},destinatario_id.eq.${p.id}),and(remetente_id.eq.${p.id},destinatario_id.eq.${entregadorId})`
            )
            .order("created_at", { ascending: false })
            .limit(1);
        }

        const { data } = await query;
        const last = data?.[0];
        return {
          ...p,
          lastMessage: last?.mensagem || "",
          lastMessageTime: last?.created_at || "",
        } as PeerWithPreview;
      })
    );

    // Sort: peers with messages first (by time desc), then without (alphabetical)
    peersWithPreview.sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime)
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      return a.nome.localeCompare(b.nome);
    });

    setPeers(peersWithPreview);
  }, [unidadeId, entregadorId]);

  useEffect(() => {
    loadPeers();
  }, [loadPeers]);

  // Load unread counts
  const loadUnread = useCallback(async () => {
    if (!entregadorId || !unidadeId) return;
    const { data: entregadorUnread } = await supabase
      .from("chat_mensagens")
      .select("remetente_id")
      .eq("destinatario_id", entregadorId)
      .eq("destinatario_tipo", "entregador")
      .eq("remetente_tipo", "entregador")
      .eq("lida", false);
    
    const { data: baseUnread } = await supabase
      .from("chat_mensagens")
      .select("id")
      .eq("destinatario_id", entregadorId)
      .eq("destinatario_tipo", "entregador")
      .eq("remetente_tipo", "base")
      .eq("lida", false);

    const counts: Record<string, number> = {};
    if (entregadorUnread) {
      entregadorUnread.forEach((m) => {
        counts[m.remetente_id] = (counts[m.remetente_id] || 0) + 1;
      });
    }
    if (baseUnread && baseUnread.length > 0) {
      counts[`base-${unidadeId}`] = baseUnread.length;
    }
    setUnreadCounts(counts);
  }, [entregadorId, unidadeId]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  // Realtime for chat messages
  useEffect(() => {
    if (!entregadorId) return;
    const channel = supabase
      .channel(`chat-entregador-${entregadorId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          const msg = payload.new as any;
          const isForMe = msg.destinatario_id === entregadorId;
          const isFromMe = msg.remetente_id === entregadorId;
          
          if (!isForMe && !isFromMe) return;

          const isBaseMsg = msg.remetente_tipo === "base" || msg.destinatario_tipo === "base";
          const isEntregadorMsg = msg.remetente_tipo === "entregador" && msg.destinatario_tipo === "entregador";

          if (!isBaseMsg && !isEntregadorMsg) return;

          let peerKey: string | null = null;
          if (isBaseMsg) {
            peerKey = `base-${unidadeId}`;
          } else if (isEntregadorMsg) {
            peerKey = isFromMe ? msg.destinatario_id : msg.remetente_id;
          }

          // Update last message preview in peers list
          if (peerKey) {
            setPeers((prev) => {
              const updated = prev.map((p) =>
                p.id === peerKey
                  ? { ...p, lastMessage: msg.mensagem, lastMessageTime: msg.created_at }
                  : p
              );
              // Re-sort
              updated.sort((a, b) => {
                if (a.lastMessageTime && b.lastMessageTime)
                  return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
                if (a.lastMessageTime) return -1;
                if (b.lastMessageTime) return 1;
                return a.nome.localeCompare(b.nome);
              });
              return updated;
            });
          }

          if (selectedPeer && peerKey === selectedPeer.id) {
            setChatMessages((prev) => [...prev, msg as ChatMsg]);
            if (isForMe && !msg.lida) {
              supabase.rpc("marcar_msg_lida" as any, { _msg_id: msg.id }).then();
            }
          } else if (isForMe && peerKey) {
            // Notify with sound + native notification when not viewing this thread
            notify(msg.remetente_nome || "Mensagem", msg.mensagem || "Nova mensagem");
            setUnreadCounts((prev) => ({
              ...prev,
              [peerKey!]: (prev[peerKey!] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entregadorId, selectedPeer, unidadeId]);

  // Load conversation when selecting peer
  useEffect(() => {
    if (!selectedPeer || !entregadorId) return;
    const load = async () => {
      setChatLoading(true);

      let query;
      if (selectedPeer.tipo === "base") {
        query = supabase
          .from("chat_mensagens")
          .select("id, remetente_id, destinatario_id, mensagem, created_at, lida, remetente_nome")
          .or(
            `and(remetente_id.eq.${entregadorId},destinatario_tipo.eq.base,destinatario_id.eq.${unidadeId}),and(destinatario_id.eq.${entregadorId},remetente_tipo.eq.base)`
          )
          .order("created_at", { ascending: true })
          .limit(200);
      } else {
        query = supabase
          .from("chat_mensagens")
          .select("id, remetente_id, destinatario_id, mensagem, created_at, lida, remetente_nome")
          .eq("remetente_tipo", "entregador")
          .eq("destinatario_tipo", "entregador")
          .or(
            `and(remetente_id.eq.${entregadorId},destinatario_id.eq.${selectedPeer.id}),and(remetente_id.eq.${selectedPeer.id},destinatario_id.eq.${entregadorId})`
          )
          .order("created_at", { ascending: true })
          .limit(200);
      }

      const { data } = await query;
      if (data) setChatMessages(data as ChatMsg[]);
      setChatLoading(false);

      if (selectedPeer.tipo === "base") {
        await supabase.rpc("marcar_chat_lido_entregador" as any, {
          _entregador_id: entregadorId,
          _remetente_id: unidadeId,
          _remetente_tipo: "base",
        });
      } else {
        await supabase.rpc("marcar_chat_lido_entregador" as any, {
          _entregador_id: entregadorId,
          _remetente_id: selectedPeer.id,
          _remetente_tipo: "entregador",
        });
      }
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[selectedPeer.id];
        return next;
      });
    };
    load();
  }, [selectedPeer, entregadorId, unidadeId]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // === AI Send ===
  const sendAi = async (text: string) => {
    if (!text.trim() || aiLoading) return;
    const userMsg: Message = { role: "user", content: text };
    const allMessages = [...aiMessages, userMsg];
    setAiMessages(allMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          entregador_id: entregadorId,
          unidade_id: unidadeId,
        }),
      });

      if (resp.status === 429) { toast.error("Muitas requisições. Aguarde."); setAiLoading(false); return; }
      if (resp.status === 402) { toast.error("Créditos insuficientes."); setAiLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Erro ao conectar");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantText = "";
      let streamDone = false;

      setAiMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (chunk) {
              assistantText += chunk;
              setAiMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantText };
                return updated;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao conectar com o assistente.");
    } finally {
      setAiLoading(false);
    }
  };

  // === Chat Send ===
  const sendChat = async (text: string) => {
    if (!text.trim() || !selectedPeer || !entregadorId) return;
    const entregadorData = await supabase
      .from("entregadores")
      .select("nome")
      .eq("id", entregadorId)
      .maybeSingle();
    const nome = entregadorData.data?.nome || "Entregador";

    const isBase = selectedPeer.tipo === "base";

    const { error } = await supabase.from("chat_mensagens").insert({
      remetente_id: entregadorId,
      remetente_tipo: "entregador",
      remetente_nome: nome,
      destinatario_id: isBase ? unidadeId : selectedPeer.id,
      destinatario_tipo: isBase ? "base" : "entregador",
      mensagem: text,
      lida: false,
    });
    if (error) {
      toast.error("Erro ao enviar mensagem.");
      return;
    }

    if (isBase && unidadeId) {
      supabase.rpc("notify_base_chat" as any, {
        _unidade_id: unidadeId,
        _entregador_nome: nome,
        _mensagem: text.substring(0, 100),
      }).then();
    }

    setChatInput("");
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const filteredPeers = peers.filter((p) =>
    p.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group messages by date for separators
  const getMessagesWithSeparators = () => {
    const result: Array<{ type: "separator"; date: string } | { type: "message"; msg: ChatMsg }> = [];
    let lastDateKey = "";
    chatMessages.forEach((msg) => {
      const dateKey = getDateKey(msg.created_at);
      if (dateKey !== lastDateKey) {
        result.push({ type: "separator", date: msg.created_at });
        lastDateKey = dateKey;
      }
      result.push({ type: "message", msg });
    });
    return result;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-xl gradient-primary text-white ring-4 ring-primary/20 hover:scale-105 transition-transform"
        >
          <Phone className="h-6 w-6 drop-shadow" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center animate-pulse">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0">
          {selectedPeer ? (
            <div className="px-4 py-3 bg-primary text-primary-foreground flex items-center gap-3">
              <button onClick={() => setSelectedPeer(null)} className="hover:opacity-80">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar className="h-9 w-9">
                <AvatarFallback className={cn(
                  "text-white text-xs font-bold",
                  selectedPeer.tipo === "base" ? "bg-warning" : getAvatarColor(selectedPeer.nome)
                )}>
                  {selectedPeer.tipo === "base" ? <Building2 className="h-4 w-4" /> : getInitials(selectedPeer.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{selectedPeer.nome}</p>
                <p className="text-[10px] opacity-70">
                  {selectedPeer.tipo === "base" ? "Administração" : "Entregador"}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Chat
              </SheetTitle>
              <Badge className="bg-primary/10 text-primary border-none text-xs">
                {tab === "ia" ? "IA" : "P2P"}
              </Badge>
            </div>
          )}
        </div>

        {!selectedPeer && (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsList className="mx-4 mt-2 mb-1 shrink-0">
              <TabsTrigger value="ia" className="flex-1 gap-1">
                <Sparkles className="h-4 w-4" /> Assistente IA
              </TabsTrigger>
              <TabsTrigger value="conversas" className="flex-1 gap-1">
                <Phone className="h-4 w-4" /> Conversas
                {totalUnread > 0 && (
                  <span className="ml-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* === IA Tab === */}
            <TabsContent value="ia" className="hidden flex-1 min-h-0 flex-col m-0 p-0 data-[state=active]:flex">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {aiMessages.length <= 1 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" /> Comandos rápidos:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SUGESTOES.map((s) => (
                          <button
                            key={s}
                            onClick={() => sendAi(s)}
                            className="text-xs bg-muted hover:bg-primary/10 text-foreground rounded-full px-3 py-1.5 border border-border transition-colors text-left"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiMessages.map((msg, i) => {
                    const isMe = msg.role === "user";
                    return (
                      <div key={i} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", isMe ? "bg-muted" : "bg-primary text-primary-foreground")}>
                          {isMe ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                        </div>
                        <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm", isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                          {isMe ? <p>{msg.content}</p> : (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                              <ReactMarkdown>{msg.content || (aiLoading && i === aiMessages.length - 1 ? "▌" : "")}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {aiLoading && aiMessages[aiMessages.length - 1]?.content === "" && (
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t flex gap-2 shrink-0">
                <Input placeholder="Fale um comando..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendAi(aiInput)} className="rounded-full" disabled={aiLoading} />
                <VoiceInputButton onResult={(text) => setAiInput((prev) => (prev ? prev + " " + text : text))} disabled={aiLoading} />
                <Button size="icon" onClick={() => sendAi(aiInput)} disabled={!aiInput.trim() || aiLoading} className="rounded-full shrink-0 gradient-primary text-white">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* === Conversas Tab (WhatsApp-style list) === */}
            <TabsContent value="conversas" className="hidden flex-1 min-h-0 flex-col m-0 p-0 data-[state=active]:flex">
              {/* Search bar */}
              <div className="px-3 py-2 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conversa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 rounded-full h-9 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                {filteredPeers.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    {searchQuery ? "Nenhum resultado." : "Nenhum contato disponível."}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredPeers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPeer(p); setTab("conversas"); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarFallback className={cn(
                            "text-white text-sm font-bold",
                            p.tipo === "base" ? "bg-warning" : getAvatarColor(p.nome)
                          )}>
                            {p.tipo === "base" ? <Building2 className="h-5 w-5" /> : getInitials(p.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className="font-medium text-sm truncate">{p.nome}</p>
                            {p.lastMessageTime && (
                              <span className={cn(
                                "text-[11px] shrink-0 ml-2",
                                (unreadCounts[p.id] || 0) > 0 ? "text-primary font-semibold" : "text-muted-foreground"
                              )}>
                                {formatMessageTime(p.lastMessageTime)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {p.lastMessage
                              ? (p.lastMessage.length > 40 ? p.lastMessage.substring(0, 40) + "..." : p.lastMessage)
                              : (p.tipo === "base" ? "Fale com a administração" : "Iniciar conversa...")}
                          </p>
                        </div>
                        {(unreadCounts[p.id] || 0) > 0 && (
                          <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                            {unreadCounts[p.id]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* === Active conversation (WhatsApp-style) === */}
        {selectedPeer && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat background pattern */}
            <ScrollArea className="flex-1 bg-[hsl(var(--muted))]/30">
              <div className="p-3 space-y-1">
                {chatLoading && (
                  <p className="text-center text-xs text-muted-foreground py-4">Carregando...</p>
                )}
                {getMessagesWithSeparators().map((item, idx) => {
                  if (item.type === "separator") {
                    return (
                      <div key={`sep-${idx}`} className="flex justify-center py-2">
                        <span className="bg-muted text-muted-foreground text-[11px] px-3 py-1 rounded-full shadow-sm font-medium">
                          {formatDateSeparator(item.date)}
                        </span>
                      </div>
                    );
                  }

                  const msg = item.msg;
                  const isMe = msg.remetente_id === entregadorId;
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[82%] rounded-lg px-3 py-1.5 text-sm shadow-sm relative",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border border-border rounded-tl-none"
                        )}
                      >
                        {!isMe && selectedPeer.tipo === "base" && msg.remetente_nome && (
                          <p className="text-[11px] font-semibold text-primary mb-0.5">{msg.remetente_nome}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.mensagem}</p>
                        <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "justify-end" : "justify-start")}>
                          <span className={cn("text-[10px]", isMe ? "opacity-70" : "text-muted-foreground")}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isMe && (
                            msg.lida
                              ? <CheckCheck className="h-3 w-3 text-info" />
                              : <Check className="h-3 w-3 opacity-60" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatScrollRef} />
              </div>
            </ScrollArea>
            <div className="p-2 border-t flex gap-2 shrink-0 bg-background">
              <Input
                placeholder="Mensagem..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)}
                className="rounded-full"
              />
              <VoiceInputButton onResult={(text) => setChatInput((prev) => (prev ? prev + " " + text : text))} />
              <Button size="icon" onClick={() => sendChat(chatInput)} disabled={!chatInput.trim()} className="rounded-full shrink-0 gradient-primary text-white">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
