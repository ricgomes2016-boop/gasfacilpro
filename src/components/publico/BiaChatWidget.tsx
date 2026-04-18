import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  unidadeSlug: "fortegas" | "centralgascp";
  nomeLoja: string;
  /** Tailwind gradient classes para o botão flutuante e header. Ex: "from-fuchsia-500 to-orange-500" */
  gradient?: string;
  /** Cor de destaque (hsl tailwind). Ex: "fuchsia-500" */
  accent?: string;
  saudacao?: string;
  /** Incremente este número para forçar abrir o chat externamente */
  openSignal?: number;
  /** Mensagem que será pré-preenchida no input ao abrir via openSignal */
  prefilledMessage?: string;
}

export function BiaChatWidget({
  unidadeSlug,
  nomeLoja,
  gradient = "from-fuchsia-500 via-purple-500 to-orange-500",
  accent = "fuchsia-500",
  saudacao,
  openSignal,
  prefilledMessage,
}: Props) {
  const storageKey = `bia-chat-${unidadeSlug}`;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        role: "assistant",
        content:
          saudacao ??
          `Oi! Sou a Bia da ${nomeLoja} 👋 Pra agilizar seu pedido, me passa seu telefone com DDD?`,
      },
    ];
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, storageKey]);

  const enviar = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const novas: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(novas);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("bia-site-chat", {
        body: {
          messages: novas,
          unidadeSlug,
        },
      });

      if (error) throw error;
      const reply = (data as any)?.reply ?? "Desculpe, não entendi. Pode repetir?";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      console.error("Erro Bia:", e);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Tive uma instabilidade aqui 😕 Tenta de novo, ou fala com a gente pelo WhatsApp.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Falar com a Bia"
          className={`fixed bottom-6 right-24 z-50 group flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-gradient-to-r ${gradient} text-white shadow-2xl shadow-${accent}/40 hover:scale-105 transition-transform`}
        >
          <span className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-20" />
          <span className="relative w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </span>
          <span className="relative font-semibold text-sm hidden sm:inline">Falar com a Bia</span>
          <span className="relative sm:hidden font-semibold text-sm">Bia</span>
          <span className="relative ml-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Painel de chat */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[380px] h-[80vh] sm:h-[560px] bg-[#0a0118] border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className={`bg-gradient-to-r ${gradient} px-4 py-3 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 text-white">
              <div className="font-bold leading-tight">Bia · {nomeLoja}</div>
              <div className="text-xs flex items-center gap-1.5 opacity-90">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                Online agora
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white p-1"
              aria-label="Fechar chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0118]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? `bg-gradient-to-br ${gradient} text-white rounded-br-sm`
                      : "bg-white/5 text-slate-100 border border-white/10 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-3 bg-[#0a0118]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder="Digite sua mensagem..."
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
              />
              <button
                onClick={enviar}
                disabled={loading || !input.trim()}
                className={`w-11 h-11 shrink-0 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform`}
                aria-label="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-white/30 text-center mt-2">
              Atendimento automático com IA
            </div>
          </div>
        </div>
      )}
    </>
  );
}
