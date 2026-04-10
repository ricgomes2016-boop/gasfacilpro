import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, X } from "lucide-react";
import { VoiceInputButton } from "@/components/ai/VoiceButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

export function ChatBase() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [entregadorNome, setEntregadorNome] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data } = await supabase
        .from("entregadores")
        .select("id, nome")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setEntregadorId(data.id);
        setEntregadorNome(data.nome);
      }
    };
    init();
  }, [user]);

  const fetchMessages = async () => {
    if (!entregadorId) return;
    // Busca mensagens enviadas pelo entregador OU recebidas por ele (direto ou broadcast para todos entregadores)
    const { data, error } = await supabase
      .from("chat_mensagens")
      .select("*")
      .or(
        `remetente_id.eq.${entregadorId},destinatario_id.eq.${entregadorId},and(destinatario_tipo.eq.entregador,destinatario_id.is.null)`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      console.error("Erro ao buscar mensagens:", error);
      return;
    }
    if (data) {
      setMessages(data as ChatMessage[]);
      const unreadCount = data.filter(
        (m) => m.remetente_tipo === "base" && !m.lida
      ).length;
      setUnread(unreadCount);
    }
  };

  useEffect(() => {
    if (entregadorId) fetchMessages();
  }, [entregadorId]);

  // Realtime subscription
  useEffect(() => {
    if (!entregadorId) return;
    const channel = supabase
      .channel(`chat-entregador-${entregadorId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          const isForMe =
            msg.remetente_id === entregadorId ||
            msg.destinatario_id === entregadorId ||
            (msg.destinatario_tipo === "entregador" && !msg.destinatario_id);

          if (isForMe) {
            setMessages((prev) => {
              // Evita duplicatas
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.remetente_tipo === "base" && !open) {
              setUnread((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Chat realtime status:", status);
      });
    return () => { supabase.removeChannel(channel); };
  }, [entregadorId, open]);

  // Mark as read when opening
  useEffect(() => {
    if (open && entregadorId && unread > 0) {
      supabase
        .from("chat_mensagens")
        .update({ lida: true })
        .eq("destinatario_id", entregadorId)
        .eq("lida", false)
        .then(() => setUnread(0));
    }
  }, [open, entregadorId, unread]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !entregadorId || sending) return;
    setSending(true);
    await supabase.from("chat_mensagens").insert({
      remetente_id: entregadorId,
      remetente_tipo: "entregador",
      remetente_nome: entregadorNome || profile?.full_name || "Entregador",
      destinatario_tipo: "base",
      mensagem: input.trim(),
    });
    setInput("");
    setSending(false);
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-lg gradient-primary text-white"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
              {unread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] p-0 rounded-t-2xl">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Chat com a Base
            </SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(80vh-140px)] p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nenhuma mensagem ainda. Envie uma mensagem para a base!
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.remetente_tipo === "entregador" && msg.remetente_id === entregadorId;
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {msg.remetente_nome || "Base"}
                      </p>
                    )}
                    <p className="text-sm">{msg.mensagem}</p>
                    <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="rounded-full"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="rounded-full shrink-0 gradient-primary text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
