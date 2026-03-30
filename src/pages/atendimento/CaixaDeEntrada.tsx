import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Search, MessageSquare, Inbox, Clock, User, Bot, Headset } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Conversa {
  id: string;
  titulo: string;
  updated_at: string;
}

interface Mensagem {
  id: string;
  role: string;
  content: string;
  created_at: string;
  conversa_id: string;
}

export default function CaixaDeEntrada() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load conversations
  useEffect(() => {
    const fetchConversas = async () => {
      const { data } = await supabase
        .from("ai_conversas")
        .select("id, titulo, updated_at")
        .order("updated_at", { ascending: false });
      setConversas(data || []);
      setLoading(false);
    };
    fetchConversas();

    const channel = supabase
      .channel("inbox-conversas")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversas" }, () => {
        fetchConversas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedId) { setMensagens([]); return; }

    const fetchMensagens = async () => {
      const { data } = await supabase
        .from("ai_mensagens")
        .select("id, role, content, created_at, conversa_id")
        .eq("conversa_id", selectedId)
        .order("created_at", { ascending: true });
      setMensagens(data || []);
    };
    fetchMensagens();

    const channel = supabase
      .channel(`inbox-msgs-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ai_mensagens",
        filter: `conversa_id=eq.${selectedId}`,
      }, (payload) => {
        setMensagens((prev) => [...prev, payload.new as Mensagem]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedId) return;
    setSending(true);
    const { error } = await supabase.from("ai_mensagens").insert({
      conversa_id: selectedId,
      role: "human",
      content: newMsg.trim(),
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setNewMsg("");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filtered = conversas.filter((c) =>
    c.titulo.toLowerCase().includes(search.toLowerCase())
  );

  const selectedConversa = conversas.find((c) => c.id === selectedId);

  const isOutgoing = (role: string) => role === "assistant" || role === "human";

  return (
    <MainLayout>
      <div className="h-[calc(100vh-3.5rem)] flex bg-background overflow-hidden">
        {/* ─── Conversation List ─── */}
        <aside
          className={cn(
            "flex flex-col border-r border-border/60 bg-muted/30 backdrop-blur-sm",
            "w-full md:w-[340px] lg:w-[380px] flex-shrink-0",
            selectedId && "hidden md:flex"
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Inbox</h1>
                <p className="text-xs text-muted-foreground">
                  {conversas.length} conversa{conversas.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-background/80 border-border/50 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-pulse text-sm text-muted-foreground">Carregando...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <MessageSquare className="h-8 w-8 opacity-40" />
                <span className="text-sm">Nenhuma conversa encontrada</span>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filtered.map((c) => (
                  <motion.button
                    key={c.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200",
                      selectedId === c.id
                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                        : "hover:bg-muted/80 border border-transparent"
                    )}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback
                        className={cn(
                          "text-xs font-semibold",
                          selectedId === c.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {c.titulo.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.titulo}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(c.updated_at), "dd MMM · HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0 opacity-60" />
                  </motion.button>
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* ─── Chat Area ─── */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0",
            !selectedId && "hidden md:flex"
          )}
        >
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="h-20 w-20 rounded-2xl bg-muted/60 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium">Selecione uma conversa</p>
                <p className="text-sm opacity-70 mt-1">Escolha uma conversa à esquerda para visualizar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-border/60 flex items-center px-4 gap-3 bg-background/80 backdrop-blur-sm flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setSelectedId(null)}
                >
                  ←
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {selectedConversa?.titulo.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedConversa?.titulo}
                  </p>
                  <p className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    WhatsApp
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="max-w-3xl mx-auto space-y-3">
                  <AnimatePresence initial={false}>
                    {mensagens.map((msg) => {
                      const outgoing = isOutgoing(msg.role);
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn("flex gap-2", outgoing ? "justify-end" : "justify-start")}
                        >
                          {!outgoing && (
                            <Avatar className="h-7 w-7 mt-1 flex-shrink-0">
                              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                                <User className="h-3.5 w-3.5" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                              outgoing
                                ? msg.role === "assistant"
                                  ? "bg-violet-600 text-white rounded-br-md"
                                  : "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted/80 text-foreground rounded-bl-md border border-border/40"
                            )}
                          >
                            {outgoing && (
                              <div className="flex items-center gap-1 mb-1 opacity-70">
                                {msg.role === "assistant" ? (
                                  <Bot className="h-3 w-3" />
                                ) : (
                                  <Headset className="h-3 w-3" />
                                )}
                                <span className="text-[10px] font-medium uppercase tracking-wider">
                                  {msg.role === "assistant" ? "Bia IA" : "Operador"}
                                </span>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p
                              className={cn(
                                "text-[10px] mt-1.5 text-right",
                                outgoing ? "opacity-60" : "text-muted-foreground"
                              )}
                            >
                              {format(new Date(msg.created_at), "HH:mm")}
                            </p>
                          </div>
                          {outgoing && (
                            <Avatar className="h-7 w-7 mt-1 flex-shrink-0">
                              <AvatarFallback
                                className={cn(
                                  "text-[10px]",
                                  msg.role === "assistant"
                                    ? "bg-violet-600 text-white"
                                    : "bg-primary text-primary-foreground"
                                )}
                              >
                                {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <Headset className="h-3.5 w-3.5" />}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t border-border/60 p-3 bg-background/80 backdrop-blur-sm flex-shrink-0">
                <div className="max-w-3xl mx-auto flex items-end gap-2">
                  <Textarea
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border/60 bg-muted/40 text-sm focus-visible:ring-primary/30"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!newMsg.trim() || sending}
                    size="icon"
                    className="h-11 w-11 rounded-xl flex-shrink-0 shadow-md shadow-primary/20"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
