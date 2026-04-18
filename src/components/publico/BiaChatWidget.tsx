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

  // Abertura externa via openSignal + prefilledMessage
  useEffect(() => {
    if (openSignal === undefined) return;
    setOpen(true);
    if (prefilledMessage) setInput(prefilledMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

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
          className={`fixed bottom-6 right-24 z-50 group flex items-center gap-3 pl-2 pr-5 py-2 rounded-full bg-[#0a0118]/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl shadow-${accent}/40 hover:scale-[1.04] active:scale-100 transition-all`}
        >
          {/* Glow halo */}
          <span
            className={`pointer-events-none absolute -inset-1 rounded-full bg-gradient-to-r ${gradient} opacity-50 blur-xl group-hover:opacity-80 transition-opacity`}
          />
          {/* Avatar com anel rotativo */}
          <span className="relative w-11 h-11 rounded-full p-[2px] overflow-hidden">
            <span
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                animationDuration: "4s",
                background: "conic-gradient(from 0deg, #fb923c, #e879f9, #a78bfa, #2dd4bf, #fb923c)",
              }}
            />
            <span className="relative w-full h-full rounded-full bg-[#0a0118] flex items-center justify-center font-black text-[13px] tracking-tight">
              <span className="bg-gradient-to-br from-orange-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
                Bia
              </span>
            </span>
          </span>
          <span className="relative flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-fuchsia-300" /> IA · Online
            </span>
            <span className="text-sm font-bold hidden sm:inline">Falar com a Bia</span>
            <span className="text-sm font-bold sm:hidden">Bia</span>
          </span>
          <span className="relative ml-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
        </button>
      )}

      {/* Painel de chat */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[380px] h-[80vh] sm:h-[560px] bg-[#0a0118] border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className={`relative bg-gradient-to-r ${gradient} px-4 py-3 flex items-center gap-3 overflow-hidden`}>
            <div className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />
            {/* Avatar header com anel rotativo */}
            <div className="relative w-12 h-12 rounded-full p-[2px] shrink-0">
              <span
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  animationDuration: "5s",
                  background: "conic-gradient(from 0deg, rgba(255,255,255,0.9), rgba(255,255,255,0.1), rgba(255,255,255,0.9))",
                }}
              />
              <span className="relative w-full h-full rounded-full bg-[#0a0118] flex items-center justify-center font-black text-sm">
                <span className="bg-gradient-to-br from-orange-200 via-fuchsia-200 to-purple-200 bg-clip-text text-transparent">
                  Bia
                </span>
              </span>
            </div>
            <div className="relative flex-1 text-white">
              <div className="font-bold leading-tight tracking-tight flex items-center gap-1.5">
                Bia <span className="text-white/60 font-normal">·</span>{" "}
                <span className="font-serif italic font-normal">{nomeLoja}</span>
              </div>
              <div className="text-[11px] flex items-center gap-1.5 opacity-95 mt-0.5">
                <Sparkles className="w-3 h-3" />
                <span className="uppercase tracking-wider font-semibold">IA · Online</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse ml-0.5" />
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
