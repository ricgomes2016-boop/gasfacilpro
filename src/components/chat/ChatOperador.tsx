import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, X, ChevronLeft, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  remetente_id: string;
  remetente_tipo: string;
  remetente_nome: string | null;
  destinatario_id: string | null;
  destinatario_tipo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

interface Entregador {
  id: string;
  nome: string;
  ativo: boolean;
  unread: number;
}

interface ChatOperadorProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
  onUnreadChange?: (count: number) => void;
}

export function ChatOperador({ externalOpen, onExternalClose, onUnreadChange }: ChatOperadorProps) {
  const [open, setOpen] = useState(false);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [selected, setSelected] = useState<Entregador | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
    onExternalClose?.();
  };

  const fetchEntregadores = async () => {
    if (!unidadeAtual?.id) {
      setEntregadores([]);
      setTotalUnread(0);
      onUnreadChange?.(0);
      return;
    }

    const { data: entregadoresData } = await supabase
      .from("entregadores")
      .select("id, nome, ativo")
      .eq("unidade_id", unidadeAtual.id)
      .eq("ativo", true)
      .order("nome");

    if (!entregadoresData) return;

    const { data: unreadData } = await supabase
      .from("chat_mensagens")
      .select("remetente_id")
      .eq("remetente_tipo", "entregador")
      .eq("destinatario_tipo", "base")
      .eq("destinatario_id", unidadeAtual.id)
      .eq("lida", false);

    const unreadMap: Record<string, number> = {};
    unreadData?.forEach((m) => {
      unreadMap[m.remetente_id] = (unreadMap[m.remetente_id] || 0) + 1;
    });

    const list = entregadoresData.map((e) => ({
      ...e,
      unread: unreadMap[e.id] || 0,
    }));

    setEntregadores(list);
    const total = Object.values(unreadMap).reduce((a, b) => a + b, 0);
    setTotalUnread(total);
    onUnreadChange?.(total);
  };

  useEffect(() => {
    fetchEntregadores();
  }, [unidadeAtual?.id]);

  useEffect(() => {
    if (!unidadeAtual?.id) return;

    const channel = supabase
      .channel(`chat-operador-list-${unidadeAtual.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_mensagens",
        filter: `destinatario_id=eq.${unidadeAtual.id}`,
      }, () => {
        fetchEntregadores();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unidadeAtual?.id]);

  const fetchMessages = async (entregadorId: string) => {
    if (!unidadeAtual?.id) return;

    const { data } = await supabase
      .from("chat_mensagens")
      .select("*")
      .or(
        `and(remetente_id.eq.${entregadorId},destinatario_tipo.eq.base,destinatario_id.eq.${unidadeAtual.id}),and(remetente_tipo.eq.base,remetente_id.eq.${unidadeAtual.id},destinatario_id.eq.${entregadorId})`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data as ChatMessage[]);
  };

  const markAsRead = async (entregadorIdToMark: string) => {
    if (!unidadeAtual?.id) return;

    // Find the unidade_id for this entregador to use as destinatario_id
    const { data: entData } = await supabase
      .from("entregadores")
      .select("unidade_id")
      .eq("id", entregadorIdToMark)
      .maybeSingle();

    if (entData?.unidade_id === unidadeAtual.id) {
      const { error } = await supabase.rpc("marcar_chat_lido_base" as any, {
        _remetente_id: entregadorIdToMark,
        _destinatario_id: unidadeAtual.id,
      });
      if (error) console.error("Erro ao marcar como lida:", error);
    }

    // Update local state immediately
    const ent = entregadores.find((e) => e.id === entregadorIdToMark);
    const unreadToRemove = ent?.unread || 0;
    setEntregadores((prev) =>
      prev.map((e) => (e.id === entregadorIdToMark ? { ...e, unread: 0 } : e))
    );
    setTotalUnread((prev) => Math.max(0, prev - unreadToRemove));
    onUnreadChange?.(Math.max(0, totalUnread - unreadToRemove));

    // Re-fetch to confirm server state
    setTimeout(() => fetchEntregadores(), 500);
  };

  const selectEntregador = async (e: Entregador) => {
    setSelected(e);
    await fetchMessages(e.id);
    await markAsRead(e.id);
  };

  useEffect(() => {
    if (!selected || !unidadeAtual?.id) return;
    const channel = supabase
      .channel(`chat-operador-conv-${unidadeAtual.id}-${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens" }, (payload) => {
        const msg = payload.new as ChatMessage;
        const isRelevant =
          (msg.remetente_id === selected.id && msg.destinatario_id === unidadeAtual.id) ||
          (msg.remetente_id === unidadeAtual.id && msg.destinatario_id === selected.id);
        if (isRelevant) {
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.remetente_tipo === "entregador") markAsRead(selected.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected, unidadeAtual?.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selected || !unidadeAtual?.id || sending) return;
    setSending(true);
    await supabase.from("chat_mensagens").insert({
      remetente_id: unidadeAtual.id,
      remetente_tipo: "base",
      remetente_nome: profile?.full_name || "Base",
      destinatario_id: selected.id,
      destinatario_tipo: "entregador",
      mensagem: input.trim(),
    });
    setInput("");
    setSending(false);
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const initials = (nome: string) =>
    nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <>
      {/* Desktop floating button - hidden, now in bottom bar */}

      {/* Chat panel */}
      {open && (
        <div className={cn(
          "fixed z-50 bg-background border shadow-2xl flex flex-col overflow-hidden",
          "bottom-[52px] left-0 right-0 h-[calc(80vh-52px)] rounded-t-2xl rounded-b-none md:bottom-16 md:right-6 md:left-auto md:w-[360px] md:h-[500px] md:max-h-[calc(100vh-5rem)] md:rounded-2xl"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-info/30 bg-info text-info-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              {selected && (
                <button onClick={() => setSelected(null)} className="mr-1 hover:opacity-80">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">
                {selected ? selected.nome : "Chat com Entregadores"}
              </span>
            </div>
            <button onClick={handleClose} className="hover:opacity-80">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Lista de entregadores */}
          {!selected && (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {entregadores.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">Nenhum entregador ativo.</p>
                )}
                {entregadores.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => selectEntregador(e)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {initials(e.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <Circle className="absolute bottom-0 right-0 h-3 w-3 fill-secondary text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{e.nome}</p>
                      <p className="text-xs text-muted-foreground">Entregador</p>
                    </div>
                    {e.unread > 0 && (
                      <Badge className="bg-destructive text-destructive-foreground text-xs h-5 min-w-5 px-1 flex items-center justify-center">
                        {e.unread}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Conversa */}
          {selected && (
            <>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {messages.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      Nenhuma mensagem ainda.
                    </p>
                  )}
                  {messages.map((msg) => {
                    const isBase = msg.remetente_tipo === "base";
                    return (
                      <div key={msg.id} className={cn("flex", isBase ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-3 py-2 shadow-sm",
                            isBase
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          )}
                        >
                          {!isBase && (
                            <p className="text-xs font-semibold mb-0.5 opacity-70">
                              {msg.remetente_nome || selected.nome}
                            </p>
                          )}
                          <p className="text-sm">{msg.mensagem}</p>
                          <p className={cn("text-[10px] mt-0.5", isBase ? "text-white/60" : "text-muted-foreground")}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="p-2 border-t flex gap-2">
                <Input
                  placeholder="Digite a mensagem..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="rounded-full text-sm"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="rounded-full shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
