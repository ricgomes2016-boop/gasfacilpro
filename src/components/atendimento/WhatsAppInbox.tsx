import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useWhatsAppNotifications } from "@/contexts/WhatsAppNotificationContext";

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

interface WhatsAppInboxProps {
  className?: string;
}

export function WhatsAppInbox({ className }: WhatsAppInboxProps) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { unreadByConversation, setSelectedConversaId, markAsRead } = useWhatsAppNotifications();

  // Sync selection with global context + cleanup on unmount
  useEffect(() => {
    setSelectedConversaId(selectedId);
    if (selectedId) markAsRead(selectedId);
  }, [selectedId, setSelectedConversaId, markAsRead]);

  useEffect(() => () => { setSelectedConversaId(null); }, [setSelectedConversaId]);

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
      .channel("inbox-conversas-shared")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversas" }, () => {
        fetchConversas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
      .channel(`inbox-msgs-shared-${selectedId}`)
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { conversa_id: selectedId, content: newMsg.trim(), unidade_id: null },
      });
      if (error) {
        toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      } else if (data?.error) {
        toast({ title: "Erro WhatsApp", description: data.error, variant: "destructive" });
      } else {
        setNewMsg("");
        toast({ title: "Mensagem enviada", description: `Via ${data?.provedor || "WhatsApp"}` });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message || "Falha ao enviar", variant: "destructive" });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filtered = conversas
    .filter((c) => c.titulo.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ua = unreadByConversation[a.id] || 0;
      const ub = unreadByConversation[b.id] || 0;
      if (ua !== ub) return ub - ua;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const selectedConversa = conversas.find((c) => c.id === selectedId);
  const isOutgoing = (role: string) => role === "assistant" || role === "human";

  return (
    <div className={cn("flex bg-background overflow-hidden border border-border/60 rounded-lg", className)}>
      {/* Conversation List */}
      <aside
        className={cn(
          "flex flex-col border-r border-border/60 bg-muted/30",
          "w-full md:w-[300px] lg:w-[340px] flex-shrink-0",
          selectedId && "hidden md:flex"
        )}
      >
        <div className="p-3 border-b border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Inbox className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Inbox WhatsApp</h2>
              <p className="text-[10px] text-muted-foreground">{conversas.length} conversa{conversas.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm rounded-lg"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-xs text-muted-foreground">Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <MessageSquare className="h-6 w-6 opacity-40" />
              <span className="text-xs">Nenhuma conversa</span>
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all",
                    selectedId === c.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/80 border border-transparent"
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-[10px] font-semibold",
                        selectedId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {c.titulo.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{c.titulo}</p>
                      {(unreadByConversation[c.id] || 0) > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-[16px] px-1 text-[9px] rounded-full flex items-center justify-center flex-shrink-0">
                          {unreadByConversation[c.id]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.updated_at), "dd MMM · HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Chat Area */}
      <div className={cn("flex-1 flex flex-col min-w-0", !selectedId && "hidden md:flex")}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
            <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Selecione uma conversa</p>
              <p className="text-xs opacity-70 mt-1">Escolha uma conversa à esquerda</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-14 border-b border-border/60 flex items-center px-3 gap-2.5 bg-background/80 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-7 w-7"
                onClick={() => setSelectedId(null)}
              >
                ←
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                  {selectedConversa?.titulo.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{selectedConversa?.titulo}</p>
                <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                  WhatsApp
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 px-3 py-3">
              <div className="max-w-3xl mx-auto space-y-2.5">
                <AnimatePresence initial={false}>
                  {mensagens.map((msg) => {
                    const outgoing = isOutgoing(msg.role);
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={cn("flex gap-2", outgoing ? "justify-end" : "justify-start")}
                      >
                        {!outgoing && (
                          <Avatar className="h-6 w-6 mt-1 flex-shrink-0">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                            outgoing
                              ? msg.role === "assistant"
                                ? "bg-violet-600 text-white rounded-br-md"
                                : "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/80 text-foreground rounded-bl-md border border-border/40"
                          )}
                        >
                          {outgoing && (
                            <div className="flex items-center gap-1 mb-1 opacity-70">
                              {msg.role === "assistant" ? <Bot className="h-2.5 w-2.5" /> : <Headset className="h-2.5 w-2.5" />}
                              <span className="text-[9px] font-medium uppercase tracking-wider">
                                {msg.role === "assistant" ? "Bia IA" : "Operador"}
                              </span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn("text-[9px] mt-1 text-right", outgoing ? "opacity-60" : "text-muted-foreground")}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border/60 p-2.5 bg-background/80 flex-shrink-0">
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <Textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="min-h-[40px] max-h-[100px] resize-none rounded-lg text-xs"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!newMsg.trim() || sending}
                  size="icon"
                  className="h-10 w-10 rounded-lg flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
