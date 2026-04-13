import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Send, Sparkles, User, Lightbulb, ArrowLeft, Check, CheckCheck, Building2 } from "lucide-react";
import { VoiceInputButton } from "@/components/ai/VoiceButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

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

const SUGESTOES = [
  "Lança 1 gás na rua Central, 50",
  "Quanto tem de P13?",
  "Transfira 10 gás pra Matriz",
  "Meus pedidos de hoje",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/entregador-chat-ia`;

export function ChatBase() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("ia");

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
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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

  // Load peers list (entregadores + base)
  useEffect(() => {
    if (!unidadeId || !entregadorId) return;
    const load = async () => {
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

      const peerList: Peer[] = [
        {
          id: `base-${unidadeId}`,
          nome: `Base ${unidade?.nome || ""}`.trim(),
          tipo: "base",
        },
        ...(entregadores || []).map((e) => ({
          id: e.id,
          nome: e.nome,
          telefone: e.telefone,
          tipo: "entregador" as const,
        })),
      ];
      setPeers(peerList);
    };
    load();
  }, [unidadeId, entregadorId]);

  // Load unread counts
  const loadUnread = useCallback(async () => {
    if (!entregadorId || !unidadeId) return;
    // Unread from entregadores
    const { data: entregadorUnread } = await supabase
      .from("chat_mensagens")
      .select("remetente_id")
      .eq("destinatario_id", entregadorId)
      .eq("destinatario_tipo", "entregador")
      .eq("remetente_tipo", "entregador")
      .eq("lida", false);
    
    // Unread from base
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
          // Messages where I'm involved
          const isForMe = msg.destinatario_id === entregadorId;
          const isFromMe = msg.remetente_id === entregadorId;
          
          if (!isForMe && !isFromMe) return;

          // Check if it's a base conversation
          const isBaseMsg = msg.remetente_tipo === "base" || msg.destinatario_tipo === "base";
          const isEntregadorMsg = msg.remetente_tipo === "entregador" && msg.destinatario_tipo === "entregador";

          if (!isBaseMsg && !isEntregadorMsg) return;

          // Determine peer key for this message
          let peerKey: string | null = null;
          if (isBaseMsg) {
            peerKey = `base-${unidadeId}`;
          } else if (isEntregadorMsg) {
            peerKey = isFromMe ? msg.destinatario_id : msg.remetente_id;
          }

          // If in active conversation with this peer
          if (selectedPeer && peerKey === selectedPeer.id) {
            setChatMessages((prev) => [...prev, msg as ChatMsg]);
            if (isForMe && !msg.lida) {
              supabase.from("chat_mensagens").update({ lida: true }).eq("id", msg.id).then();
            }
          } else if (isForMe && peerKey) {
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
        // Messages between me (entregador) and base for my unidade
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

      // Mark all as read
      if (selectedPeer.tipo === "base") {
        await supabase
          .from("chat_mensagens")
          .update({ lida: true })
          .eq("destinatario_id", entregadorId)
          .eq("remetente_tipo", "base")
          .eq("lida", false);
      } else {
        await supabase
          .from("chat_mensagens")
          .update({ lida: true })
          .eq("destinatario_id", entregadorId)
          .eq("remetente_id", selectedPeer.id)
          .eq("remetente_tipo", "entregador")
          .eq("lida", false);
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

    // Create notification for base admins/gestores
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
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {selectedPeer ? (
                <>
                  <button onClick={() => setSelectedPeer(null)} className="mr-1">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  {selectedPeer.tipo === "base" ? (
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {selectedPeer.nome}
                    </span>
                  ) : selectedPeer.nome}
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 text-primary" />
                  Chat
                </>
              )}
            </SheetTitle>
            <Badge className="bg-primary/10 text-primary border-none text-xs">
              {tab === "ia" ? "IA" : "P2P"}
            </Badge>
          </div>
        </SheetHeader>

        {!selectedPeer && (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-4 mt-0 mb-0 shrink-0">
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
            <TabsContent value="ia" className="flex-1 flex flex-col min-h-0 mt-0">
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

            {/* === Conversas Tab (list) === */}
            <TabsContent value="conversas" className="flex-1 flex flex-col min-h-0 mt-0 pt-0">
              <ScrollArea className="flex-1">
                {peers.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Nenhum contato disponível.
                  </div>
                ) : (
                  <div className="divide-y">
                    {peers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPeer(p); setTab("conversas"); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          p.tipo === "base" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"
                        )}>
                          {p.tipo === "base" ? (
                            <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <User className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.tipo === "base" ? "Fale com a administração" : (p.telefone || "Entregador")}
                          </p>
                        </div>
                        {(unreadCounts[p.id] || 0) > 0 && (
                          <span className="h-5 min-w-5 px-1 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
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

        {/* === Active conversation === */}
        {selectedPeer && (
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {chatLoading && (
                  <p className="text-center text-xs text-muted-foreground py-4">Carregando...</p>
                )}
                {chatMessages.map((msg) => {
                  const isMe = msg.remetente_id === entregadorId;
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        isMe
                          ? "bg-[hsl(var(--primary))] text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}>
                        {!isMe && selectedPeer.tipo === "base" && msg.remetente_nome && (
                          <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.remetente_nome}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.mensagem}</p>
                        <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "justify-end" : "justify-start")}>
                          <span className="text-[10px] opacity-70">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isMe && (
                            msg.lida
                              ? <CheckCheck className="h-3 w-3 opacity-70" />
                              : <Check className="h-3 w-3 opacity-50" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatScrollRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2 shrink-0">
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
