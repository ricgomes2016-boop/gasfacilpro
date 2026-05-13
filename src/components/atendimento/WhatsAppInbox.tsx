/**
 * WhatsApp Inbox - Visual idêntico ao WhatsApp Web real
 * 
 * Design:
 * - Sidebar esquerda com lista de conversas (fundo #f0f2f5)
 * - Header verde com avatar e info do contato
 * - Bolhas de mensagem: verde claro (enviadas) e brancas (recebidas)
 * - Background com padrão doodle do WhatsApp
 * - Barra de input com ícones
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Search, MessageSquare, ArrowLeft, Bot, Headset, User, Smile, Paperclip, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppNotifications } from "@/contexts/WhatsAppNotificationContext";

interface Conversa {
  id: string;
  titulo: string;
  updated_at: string;
  telefone: string | null;
  last_message?: string | null;
  last_role?: string | null;
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

  // Sync selection with global context
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

  // Get last message for preview
  const getLastMessage = (conversaId: string) => {
    // We don't have this data readily available, so show time only
    return null;
  };

  return (
    <div className={cn("flex overflow-hidden", className)} style={{ backgroundColor: '#eae6df' }}>
      {/* Left Sidebar - Conversation List */}
      <aside
        className={cn(
          "flex flex-col bg-white border-r border-[#e9edef]",
          "w-full md:w-[340px] lg:w-[380px] flex-shrink-0",
          selectedId && "hidden md:flex"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-[60px] bg-[#f0f2f5] flex items-center px-4 gap-3">
          <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center">
            <User className="h-5 w-5 text-[#8696a0]" />
          </div>
          <div className="flex-1" />
          <button className="p-2 rounded-full hover:bg-[#e9edef] transition-colors">
            <svg viewBox="0 0 24 24" width="20" height="20" className="text-[#54656f]">
              <path fill="currentColor" d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/>
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-2 py-1.5 bg-white border-b border-[#e9edef]">
          <div className="relative flex items-center bg-[#f0f2f5] rounded-lg px-3 py-1.5">
            <Search className="h-4 w-4 text-[#54656f] mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar ou começar uma nova conversa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-[#3b4a54] placeholder-[#667781] outline-none"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-sm text-[#667781]">Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#667781] gap-2">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <span className="text-sm">Nenhuma conversa</span>
            </div>
          ) : (
            filtered.map((c) => {
              const unread = unreadByConversation[c.id] || 0;
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-[#e9edef]",
                    isSelected ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                  )}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-[#dfe5e7] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#8696a0] text-sm font-medium">
                      {c.titulo.slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[#111b21] text-base truncate font-normal">
                        {c.titulo}
                      </p>
                      <span className={cn(
                        "text-xs flex-shrink-0 ml-2",
                        unread > 0 ? "text-[#00a884]" : "text-[#667781]"
                      )}>
                        {format(new Date(c.updated_at), "HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[#667781] text-sm truncate">
                        Toque para ver mensagens
                      </p>
                      {unread > 0 && (
                        <span className="bg-[#25d366] text-white text-[11px] font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0 ml-2">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Panel - Chat Area */}
      <div className={cn("flex-1 flex flex-col min-w-0", !selectedId && "hidden md:flex")}>
        {!selectedId ? (
          /* Empty State - WhatsApp style */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-b-[6px] border-[#00a884]">
            <div className="text-center space-y-4">
              <div className="mx-auto w-[320px] h-[188px] flex items-center justify-center opacity-30">
                <svg viewBox="0 0 303 172" width="303" height="172">
                  <path fill="#DAF7C3" d="M229.565 160.229c32.647-16.166 51.418-50.323 51.418-86.642C280.983 32.722 248.26 0 207.395 0c-25.666 0-48.236 13.14-61.423 33.035C132.785 13.14 110.215 0 84.55 0 43.683 0 10.963 32.722 10.963 73.587c0 36.32 18.77 70.476 51.418 86.642C97.39 177.476 145.972 172 145.972 172s48.581 5.476 83.593-11.771z"/>
                  <path fill="#FFF" d="M145.972 172s-48.581 5.476-83.593-11.771C29.733 144.063 10.963 109.906 10.963 73.587 10.963 32.722 43.683 0 84.55 0c25.666 0 48.236 13.14 61.423 33.035C132.785 13.14 110.215 0 84.55 0" opacity=".08"/>
                </svg>
              </div>
              <h2 className="text-[#41525d] text-3xl font-light">WhatsApp Web</h2>
              <p className="text-[#667781] text-sm max-w-md leading-relaxed">
                Envie e receba mensagens sem precisar manter seu celular conectado.
                <br />
                Selecione uma conversa para começar.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-[60px] bg-[#f0f2f5] flex items-center px-4 gap-3 border-b border-[#e9edef] flex-shrink-0">
              {/* Back button (mobile) */}
              <button
                className="md:hidden p-1 rounded-full hover:bg-[#e9edef] mr-1"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-5 w-5 text-[#54656f]" />
              </button>

              {/* Contact Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center flex-shrink-0">
                <span className="text-[#8696a0] text-sm font-medium">
                  {selectedConversa?.titulo.slice(0, 2).toUpperCase()}
                </span>
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[#111b21] text-base font-normal truncate">
                  {selectedConversa?.titulo}
                </p>
                <p className="text-[#667781] text-xs">
                  online
                </p>
              </div>

              {/* Header Actions */}
              <button className="p-2 rounded-full hover:bg-[#e9edef] transition-colors">
                <Search className="h-5 w-5 text-[#54656f]" />
              </button>
              <button className="p-2 rounded-full hover:bg-[#e9edef] transition-colors">
                <svg viewBox="0 0 24 24" width="20" height="20" className="text-[#54656f]">
                  <path fill="currentColor" d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/>
                </svg>
              </button>
            </div>

            {/* Messages Area - WhatsApp doodle background */}
            <div
              className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-16 py-4"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 5 L25 10 L20 15 L15 10 Z' fill='%23d4cfc6' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23p)'/%3E%3C/svg%3E")`,
              }}
            >
              <div className="max-w-3xl mx-auto space-y-1">
                <AnimatePresence initial={false}>
                  {mensagens.map((msg, idx) => {
                    const outgoing = isOutgoing(msg.role);
                    const showDate = idx === 0 || 
                      format(new Date(msg.created_at), "yyyy-MM-dd") !== format(new Date(mensagens[idx-1].created_at), "yyyy-MM-dd");
                    
                    return (
                      <div key={msg.id}>
                        {/* Date separator */}
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="bg-white/90 text-[#54656f] text-[11px] px-3 py-1 rounded-lg shadow-sm">
                              {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.1 }}
                          className={cn("flex mb-0.5", outgoing ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "relative max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm text-sm",
                              outgoing
                                ? msg.role === "assistant"
                                  ? "bg-[#d9fdd3] text-[#111b21]" // BIA - verde claro
                                  : "bg-[#d9fdd3] text-[#111b21]" // Operador - verde claro
                                : "bg-white text-[#111b21]" // Cliente - branco
                            )}
                            style={{
                              borderTopLeftRadius: outgoing ? '8px' : '0px',
                              borderTopRightRadius: outgoing ? '0px' : '8px',
                            }}
                          >
                            {/* Sender label for outgoing */}
                            {outgoing && (
                              <div className="flex items-center gap-1 mb-0.5">
                                {msg.role === "assistant" ? (
                                  <span className="text-[11px] font-medium text-[#6b3fa0]">
                                    <Bot className="h-3 w-3 inline mr-0.5" />
                                    BIA
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-[#00a884]">
                                    <Headset className="h-3 w-3 inline mr-0.5" />
                                    Operador
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Message content */}
                            <p className="whitespace-pre-wrap break-words leading-[1.35] text-[14.2px]">
                              {msg.content}
                            </p>

                            {/* Timestamp */}
                            <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                              <span className="text-[11px] text-[#667781]">
                                {format(new Date(msg.created_at), "HH:mm")}
                              </span>
                              {outgoing && (
                                <svg viewBox="0 0 16 11" width="16" height="11" className="text-[#53bdeb]">
                                  <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0-.14.337c0 .13.046.24.14.337l2.357 2.526a.452.452 0 0 0 .336.14.501.501 0 0 0 .381-.178l6.484-8.001a.462.462 0 0 0 .102-.382.463.463 0 0 0-.102-.396zm-3.25 7.93l.56-.7 2.465 2.526a.452.452 0 0 0 .336.14.501.501 0 0 0 .381-.178l6.484-8.001a.462.462 0 0 0 .102-.382.463.463 0 0 0-.102-.396.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-.543-.565"/>
                                </svg>
                              )}
                            </div>

                            {/* Tail */}
                            <div
                              className={cn(
                                "absolute top-0 w-2 h-3",
                                outgoing ? "-right-2" : "-left-2"
                              )}
                            >
                              <svg viewBox="0 0 8 13" width="8" height="13">
                                {outgoing ? (
                                  <path fill="#d9fdd3" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"/>
                                ) : (
                                  <path fill="#fff" d="M6.467 3.568 0 12.193V1h5.188c1.77 0 2.338 1.156 1.279 2.568z"/>
                                )}
                              </svg>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] px-4 py-2.5 flex items-end gap-2 flex-shrink-0">
              {/* Emoji button */}
              <button className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0">
                <Smile className="h-6 w-6 text-[#54656f]" />
              </button>

              {/* Attach button */}
              <button className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0">
                <Paperclip className="h-6 w-6 text-[#54656f] rotate-45" />
              </button>

              {/* Text Input */}
              <div className="flex-1 bg-white rounded-lg px-3 py-2.5 min-h-[42px] max-h-[120px] flex items-center">
                <textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem"
                  className="w-full bg-transparent text-[15px] text-[#3b4a54] placeholder-[#667781] outline-none resize-none leading-[1.35] max-h-[100px]"
                  rows={1}
                  style={{ height: 'auto', minHeight: '21px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                  }}
                />
              </div>

              {/* Send / Mic button */}
              {newMsg.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="h-6 w-6 text-[#54656f]" />
                </button>
              ) : (
                <button className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0">
                  <Mic className="h-6 w-6 text-[#54656f]" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
