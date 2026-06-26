import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Send, ArrowLeft, Check, CheckCheck, User, Search, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { useChatNotification } from "@/hooks/useChatNotification";

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
  unidade_id: string;
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [unidadeIds, setUnidadeIds] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>("");
  const { notify } = useChatNotification();

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
        if (unidades) setUnidadeIds(unidades.map((u) => u.id));
      }
    };
    init();
  }, [user]);

  const loadThreads = useCallback(async () => {
    if (unidadeIds.length === 0) return;

    // Fetch all active entregadores for the user's unidades
    const { data: allEntregadores } = await supabase
      .from("entregadores")
      .select("id, nome, unidade_id")
      .eq("ativo", true)
      .in("unidade_id", unidadeIds)
      .order("nome");

    const orFilter = unidadeIds
      .map((uid) => `and(destinatario_tipo.eq.base,destinatario_id.eq.${uid}),and(remetente_tipo.eq.base,remetente_id.eq.${uid})`)
      .join(",");

    const { data } = await supabase
      .from("chat_mensagens")
      .select("remetente_id, remetente_nome, mensagem, created_at, lida, remetente_tipo, destinatario_tipo, destinatario_id")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(500);

    const entregadorLookup = new Map(
      (allEntregadores || []).map((entregador) => [entregador.id, entregador] as const)
    );

    const threadMap: Record<string, EntregadorThread> = {};
    let totalUn = 0;

    // Build threads from messages
    (data || []).forEach((msg) => {
      let eId = "";
      let eName = "";
      let uId = "";

      if (msg.remetente_tipo === "entregador") {
        eId = msg.remetente_id;
        eName = msg.remetente_nome || "";
        uId = msg.destinatario_id || "";
      } else {
        eId = msg.destinatario_id || "";
        eName = threadMap[eId]?.entregador_nome || "";
        uId = msg.remetente_id || "";
      }

      if (!eId) return;

      const entregador = entregadorLookup.get(eId);
      const currentThread = threadMap[eId];
      const resolvedName = entregador?.nome || eName || currentThread?.entregador_nome || "Entregador";
      const resolvedUnidadeId = uId || entregador?.unidade_id || currentThread?.unidade_id || "";

      if (!currentThread) {
        threadMap[eId] = {
          entregador_id: eId,
          entregador_nome: resolvedName,
          unidade_id: resolvedUnidadeId,
          last_message: msg.mensagem,
          last_time: msg.created_at,
          unread: 0,
        };
      } else {
        if (currentThread.entregador_nome === "Entregador" && resolvedName !== "Entregador") {
          currentThread.entregador_nome = resolvedName;
        }

        if (!currentThread.unidade_id && resolvedUnidadeId) {
          currentThread.unidade_id = resolvedUnidadeId;
        }
      }

      if (msg.remetente_tipo === "entregador" && msg.destinatario_tipo === "base" && !msg.lida) {
        threadMap[eId].unread++;
        totalUn++;
      }
    });

    // Merge entregadores without conversations
    (allEntregadores || []).forEach((e) => {
      if (!threadMap[e.id]) {
        threadMap[e.id] = {
          entregador_id: e.id,
          entregador_nome: e.nome,
          unidade_id: e.unidade_id || unidadeIds[0],
          last_message: "",
          last_time: "",
          unread: 0,
        };
      } else {
        if (threadMap[e.id].entregador_nome === "Entregador") {
          threadMap[e.id].entregador_nome = e.nome;
        }

        if (!threadMap[e.id].unidade_id) {
          threadMap[e.id].unidade_id = e.unidade_id || unidadeIds[0];
        }
      }
    });

    // Sort: threads with messages first (by time), then entregadores without messages (alphabetical)
    const sorted = Object.values(threadMap).sort((a, b) => {
      if (a.last_time && b.last_time) return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
      if (a.last_time) return -1;
      if (b.last_time) return 1;
      return a.entregador_nome.localeCompare(b.entregador_nome);
    });

    setThreads(sorted);
    setTotalUnread(totalUn);
    setSelectedThread((prev) =>
      prev ? sorted.find((thread) => thread.entregador_id === prev.entregador_id) ?? prev : null
    );
  }, [unidadeIds]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (unidadeIds.length === 0) return;
    const channelScope = unidadeIds.slice().sort().join("-");
    const channel = supabase
      .channel(`chat-base-${channelScope}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.remetente_tipo === "entregador" && msg.destinatario_tipo === "base" && unidadeIds.includes(msg.destinatario_id)) {
            // Only skip notification if chat is open AND viewing this exact thread
            const isViewingThisThread = open && selectedThread && msg.remetente_id === selectedThread.entregador_id;
            if (!isViewingThisThread) {
              notify(msg.remetente_nome || "Entregador", msg.mensagem || "Nova mensagem");
            }
            if (selectedThread && msg.remetente_id === selectedThread.entregador_id) {
              setMessages((prev) => [...prev, msg as ChatMsg]);
              supabase.rpc("marcar_msg_lida" as any, { _msg_id: msg.id }).then();
            } else {
              loadThreads();
            }
          }
          if (msg.remetente_tipo === "base" && selectedThread && msg.destinatario_id === selectedThread.entregador_id) {
            setMessages((prev) => [...prev, msg as ChatMsg]);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeIds, selectedThread, loadThreads, open]);

  useEffect(() => {
    if (!selectedThread) return;
    const load = async () => {
      setLoading(true);
      const eId = selectedThread.entregador_id;
      const uId = selectedThread.unidade_id;

      const { data } = await supabase
        .from("chat_mensagens")
        .select("id, remetente_id, destinatario_id, mensagem, created_at, lida, remetente_nome, remetente_tipo")
        .or(
          `and(remetente_id.eq.${eId},destinatario_tipo.eq.base,destinatario_id.eq.${uId}),and(remetente_tipo.eq.base,remetente_id.eq.${uId},destinatario_id.eq.${eId})`
        )
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) setMessages(data as ChatMsg[]);
      setLoading(false);

      const { error } = await supabase.rpc("marcar_chat_lido_base" as any, {
        _remetente_id: eId,
        _destinatario_id: uId,
      });
      if (error) console.error("Erro ao marcar como lida:", error);

      // Update local state immediately
      setSelectedThread((prev) => prev ? { ...prev, unread: 0 } : null);
      setThreads((prev) =>
        prev.map((t) => (t.entregador_id === eId ? { ...t, unread: 0 } : t))
      );
      setTotalUnread((prev) => Math.max(0, prev - (selectedThread.unread || 0)));
    };
    load();
  }, [selectedThread?.entregador_id]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedThread) return;
    const { error } = await supabase.from("chat_mensagens").insert({
      remetente_id: selectedThread.unidade_id,
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

  const initials = (nome: string) =>
    nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  const filteredThreads = threads.filter((t) =>
    t.entregador_nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Phone className="h-5 w-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-info/30 bg-info text-info-foreground flex items-center gap-3">
          {selectedThread ? (
            <>
              <button onClick={() => setSelectedThread(null)} className="hover:opacity-80">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs font-bold">
                  {initials(selectedThread.entregador_nome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm leading-tight">{selectedThread.entregador_nome}</p>
                <p className="text-[10px] opacity-70">Entregador</p>
              </div>
            </>
          ) : (
            <>
              <MessagesSquare className="h-5 w-5" />
              <p className="font-semibold text-sm">Chat com Entregadores</p>
            </>
          )}
        </div>

        {!selectedThread ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar entregador..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-full h-9 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {search ? "Nenhum resultado." : "Nenhuma conversa ainda."}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredThreads.map((t) => (
                    <button
                      key={t.entregador_id}
                      onClick={() => setSelectedThread(t)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {initials(t.entregador_nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-sm truncate">{t.entregador_nome}</p>
                          {t.last_time && (
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                              {format(new Date(t.last_time), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.last_message || "Iniciar conversa..."}
                        </p>
                      </div>
                      {t.unread > 0 && (
                        <span className="h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center shrink-0">
                          {t.unread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
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
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          isBase
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        )}
                      >
                        {!isBase && msg.remetente_nome && (
                          <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.remetente_nome}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.mensagem}</p>
                        <div className={cn("flex items-center gap-1 mt-0.5", isBase ? "justify-end" : "justify-start")}>
                          <span className="text-[10px] opacity-70">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isBase &&
                            (msg.lida ? (
                              <CheckCheck className="h-3 w-3 opacity-70" />
                            ) : (
                              <Check className="h-3 w-3 opacity-50" />
                            ))}
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
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="rounded-full shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
