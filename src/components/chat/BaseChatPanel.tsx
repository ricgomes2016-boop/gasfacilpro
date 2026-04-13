import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, ArrowLeft, Check, CheckCheck, User, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChatMsg {
  id: string;
  remetente_id: string;
  destinatario_id: string | null;
  mensagem: string;
  created_at: string;
  lida: boolean;
  remetente_nome?: string | null;
  remetente_tipo?: string;
}

interface EntregadorThread {
  entregador_id: string;
  entregador_nome: string;
  last_message: string;
  last_time: string;
  unread: number;
}

export function BaseChatPanel() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<EntregadorThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EntregadorThread | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [userUnidadeIds, setUserUnidadeIds] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>("");

  // Get user's unidades
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (profile?.full_name) setUserName(profile.full_name);

      if (profile?.empresa_id) {
        const { data: unidades } = await supabase
          .from("unidades")
          .select("id")
          .eq("empresa_id", profile.empresa_id)
          .eq("ativo", true);
        if (unidades) setUserUnidadeIds(unidades.map(u => u.id));
      }
    };
    init();
  }, [user]);

  // Load threads (entregadores who messaged the base)
  const loadThreads = useCallback(async () => {
    if (!userUnidadeId) return;
    
    // Get all messages sent to base for this unidade
    const { data } = await supabase
      .from("chat_mensagens")
      .select("remetente_id, remetente_nome, mensagem, created_at, lida, remetente_tipo, destinatario_tipo, destinatario_id")
      .or(`and(destinatario_tipo.eq.base,destinatario_id.eq.${userUnidadeId}),and(remetente_tipo.eq.base,remetente_id.eq.${userUnidadeId})`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!data) return;

    // Group by entregador
    const threadMap: Record<string, EntregadorThread> = {};
    let totalUn = 0;

    data.forEach((msg) => {
      // Determine the entregador in this conversation
      let eId: string;
      let eName: string;
      
      if (msg.remetente_tipo === "entregador") {
        eId = msg.remetente_id;
        eName = msg.remetente_nome || "Entregador";
      } else {
        // Message from base to entregador
        eId = msg.destinatario_id || "";
        eName = threadMap[eId]?.entregador_nome || "Entregador";
      }

      if (!eId) return;

      if (!threadMap[eId]) {
        threadMap[eId] = {
          entregador_id: eId,
          entregador_nome: eName,
          last_message: msg.mensagem,
          last_time: msg.created_at,
          unread: 0,
        };
      }

      // Count unread (messages from entregador to base that are not read)
      if (msg.remetente_tipo === "entregador" && msg.destinatario_tipo === "base" && !msg.lida) {
        threadMap[eId].unread++;
        totalUn++;
      }
    });

    setThreads(Object.values(threadMap).sort((a, b) => 
      new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    ));
    setTotalUnread(totalUn);
  }, [userUnidadeId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Realtime
  useEffect(() => {
    if (!userUnidadeId) return;
    const channel = supabase
      .channel(`chat-base-${userUnidadeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.destinatario_tipo === "base" && msg.destinatario_id === userUnidadeId) {
            // New message from entregador to base
            if (selectedThread && msg.remetente_id === selectedThread.entregador_id) {
              setMessages((prev) => [...prev, msg as ChatMsg]);
              supabase.from("chat_mensagens").update({ lida: true }).eq("id", msg.id).then();
            } else {
              loadThreads();
            }
          }
          // Message from base (sent by another admin)
          if (msg.remetente_tipo === "base" && selectedThread && msg.destinatario_id === selectedThread.entregador_id) {
            setMessages((prev) => [...prev, msg as ChatMsg]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userUnidadeId, selectedThread, loadThreads]);

  // Load conversation with specific entregador
  useEffect(() => {
    if (!selectedThread || !userUnidadeId) return;
    const load = async () => {
      setLoading(true);
      const eId = selectedThread.entregador_id;
      
      const { data } = await supabase
        .from("chat_mensagens")
        .select("id, remetente_id, destinatario_id, mensagem, created_at, lida, remetente_nome, remetente_tipo")
        .or(
          `and(remetente_id.eq.${eId},destinatario_tipo.eq.base,destinatario_id.eq.${userUnidadeId}),and(remetente_tipo.eq.base,destinatario_id.eq.${eId})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      
      if (data) setMessages(data as ChatMsg[]);
      setLoading(false);

      // Mark as read
      await supabase
        .from("chat_mensagens")
        .update({ lida: true })
        .eq("remetente_id", eId)
        .eq("destinatario_tipo", "base")
        .eq("destinatario_id", userUnidadeId)
        .eq("lida", false);
      
      loadThreads();
    };
    load();
  }, [selectedThread, userUnidadeId, loadThreads]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedThread || !userUnidadeId) return;

    const { error } = await supabase.from("chat_mensagens").insert({
      remetente_id: userUnidadeId,
      remetente_tipo: "base",
      remetente_nome: userName || "Base",
      destinatario_id: selectedThread.entregador_id,
      destinatario_tipo: "entregador",
      mensagem: text,
      lida: false,
    });

    if (error) {
      toast.error("Erro ao enviar mensagem.");
      return;
    }
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2">
          <MessageCircle className="h-4 w-4" />
          Chat Entregadores
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {selectedThread ? (
              <>
                <button onClick={() => setSelectedThread(null)} className="mr-1">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <User className="h-4 w-4 text-primary" />
                {selectedThread.entregador_nome}
              </>
            ) : (
              <>
                <Building2 className="h-5 w-5 text-primary" />
                Chat com Entregadores
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {!selectedThread ? (
          <ScrollArea className="flex-1">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma conversa ainda. Os entregadores podem iniciar uma conversa pelo app.
              </div>
            ) : (
              <div className="divide-y">
                {threads.map((t) => (
                  <button
                    key={t.entregador_id}
                    onClick={() => setSelectedThread(t)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-medium text-sm truncate">{t.entregador_nome}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(t.last_time), "HH:mm")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.last_message}</p>
                    </div>
                    {t.unread > 0 && (
                      <span className="h-5 min-w-5 px-1 rounded-full bg-destructive text-white text-xs flex items-center justify-center shrink-0">
                        {t.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {loading && (
                  <p className="text-center text-xs text-muted-foreground py-4">Carregando...</p>
                )}
                {messages.map((msg) => {
                  const isBase = msg.remetente_tipo === "base";
                  return (
                    <div key={msg.id} className={cn("flex", isBase ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        isBase
                          ? "bg-[hsl(var(--primary))] text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}>
                        {!isBase && msg.remetente_nome && (
                          <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.remetente_nome}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.mensagem}</p>
                        <div className={cn("flex items-center gap-1 mt-0.5", isBase ? "justify-end" : "justify-start")}>
                          <span className="text-[10px] opacity-70">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isBase && (
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
                placeholder="Responder..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                className="rounded-full"
              />
              <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim()} className="rounded-full shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
