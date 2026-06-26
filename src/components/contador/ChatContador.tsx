import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send } from "lucide-react";
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

export function ChatContador() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();

  const fetchMessages = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_mensagens")
      .select("*")
      .or("remetente_tipo.eq.contador,destinatario_tipo.eq.contador")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      console.error("Erro ao buscar mensagens:", error);
      return;
    }
    if (data) {
      setMessages(data as ChatMessage[]);
      const unreadCount = data.filter(
        (m) => m.remetente_tipo !== "contador" && !m.lida
      ).length;
      setUnread(unreadCount);
    }
  };

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-contador-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (msg.remetente_tipo === "contador" || msg.destinatario_tipo === "contador") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.remetente_tipo !== "contador" && !open) {
              setUnread((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, open]);

  // Mark as read
  useEffect(() => {
    if (open && user && unread > 0) {
      supabase
        .from("chat_mensagens")
        .update({ lida: true })
        .eq("destinatario_tipo", "contador")
        .eq("lida", false)
        .then(() => setUnread(0));
    }
  }, [open, user, unread]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    await supabase.from("chat_mensagens").insert({
      remetente_id: user.id,
      remetente_tipo: "contador",
      remetente_nome: profile?.full_name || "Contador",
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
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
              {unread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chat com a Empresa
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-160px)] p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nenhuma mensagem. Envie uma mensagem para a empresa!
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.remetente_tipo === "contador";
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
                        {msg.remetente_nome || "Empresa"}
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
            className="rounded-full shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
