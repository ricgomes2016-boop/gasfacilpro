import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles, Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Marca abstrata moderna da Bia: núcleo pulsante + órbitas + brilho */
function BiaMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="biaGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2fc2b5" />
          <stop offset="55%" stopColor="#6c63ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="biaCore" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="60%" stopColor="#e879f9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Órbita 1 */}
      <ellipse
        cx="16" cy="16" rx="13" ry="5"
        stroke="url(#biaGrad)" strokeWidth="1.6" fill="none" opacity="0.95"
        transform="rotate(30 16 16)"
      />
      {/* Órbita 2 */}
      <ellipse
        cx="16" cy="16" rx="13" ry="5"
        stroke="url(#biaGrad)" strokeWidth="1.4" fill="none" opacity="0.7"
        transform="rotate(-30 16 16)"
      />

      {/* Núcleo (halo) */}
      <circle cx="16" cy="16" r="8" fill="url(#biaCore)" opacity="0.6" />
      {/* Núcleo sólido */}
      <circle cx="16" cy="16" r="3.6" fill="url(#biaGrad)">
        <animate attributeName="r" values="3.4;4;3.4" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Partículas nas órbitas */}
      <circle cx="29" cy="16" r="1.2" fill="#2fc2b5">
        <animateTransform attributeName="transform" type="rotate" from="30 16 16" to="390 16 16" dur="6s" repeatCount="indefinite" />
      </circle>
      <circle cx="3" cy="16" r="1" fill="#e879f9">
        <animateTransform attributeName="transform" type="rotate" from="-30 16 16" to="-390 16 16" dur="7s" repeatCount="indefinite" />
      </circle>

      {/* Faísca */}
      <path d="M25 6 L26 8 L28 9 L26 10 L25 12 L24 10 L22 9 L24 8 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  unidadeSlug: "fortegas" | "centralgascp" | "japagas";
  nomeLoja: string;
  /** Tailwind gradient classes para o botão flutuante e header. Ex: "from-primary via-secondary to-accent" */
  gradient?: string;
  /** Cor de destaque (hsl tailwind). Ex: "fuchsia-500" */
  accent?: string;
  saudacao?: string;
  /** Incremente este número para forçar abrir o chat externamente */
  openSignal?: number;
  /** Mensagem que será pré-preenchida no input ao abrir via openSignal */
  prefilledMessage?: string;
  /** Lançador discreto (sem glow/halo e com rótulo curto), para não competir com o CTA de WhatsApp */
  compact?: boolean;
  /** Sobrescreve posicionamento/cores do botão flutuante */
  launcherClassName?: string;
}

export function BiaChatWidget({
  unidadeSlug,
  nomeLoja,
  gradient = "from-primary via-secondary to-accent",
  accent = "fuchsia-500",
  saudacao,
  openSignal,
  prefilledMessage,
  compact = false,
  launcherClassName,
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
          `Olá, sou a Bia da ${nomeLoja}. Para iniciar seu pedido, informe seu telefone com DDD, por favor.`,
      },
    ];
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const sttSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, storageKey]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, []);

  const toggleMic = () => {
    if (!sttSupported) {
      alert("Seu navegador não suporta gravação por voz. Tente pelo Chrome no Android.");
      return;
    }
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setListening(false);
      return;
    }
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((interim || final).trim());
    };
    rec.onerror = (e: any) => {
      console.error("STT error:", e?.error);
      setListening(false);
      if (e?.error === "not-allowed") {
        alert("Permita o acesso ao microfone nas configurações do navegador.");
      }
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      console.error(err);
      setListening(false);
    }
  };

  // Abertura externa via openSignal + prefilledMessage (ignora valor inicial 0)
  useEffect(() => {
    if (!openSignal) return;
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
          aria-label="Falar com a Bia, assistente virtual"
          className={
            compact
              ? `fixed z-40 group flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full border border-white/15 text-white shadow-lg hover:brightness-110 transition-[filter,transform] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  launcherClassName ?? "bottom-6 right-24 bg-[#0a0118]/90"
                }`
              : `fixed bottom-6 right-24 z-50 group flex items-center gap-3 pl-2 pr-5 py-2 rounded-full bg-[#0a0118]/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl shadow-${accent}/40 hover:scale-[1.04] active:scale-100 transition-all ${launcherClassName ?? ""}`
          }
        >
          {/* Glow halo */}
          {!compact && (
            <span
              className={`pointer-events-none absolute -inset-1 rounded-full bg-gradient-to-r ${gradient} opacity-50 blur-xl group-hover:opacity-80 transition-opacity`}
            />
          )}
          {/* Avatar moderno: orbital com núcleo pulsante */}
          <span className={`relative rounded-full p-[2px] overflow-hidden ${compact ? "w-8 h-8" : "w-11 h-11"}`}>
            <span
              className={`absolute inset-0 rounded-full ${compact ? "" : "animate-spin"}`}
              style={{
                animationDuration: "4s",
                background: "conic-gradient(from 0deg, #2fc2b5, #6c63ff, #8b5cf6, #2dd4bf, #2fc2b5)",
              }}
            />
            <span className="relative w-full h-full rounded-full bg-[#0a0118] flex items-center justify-center">
              <BiaMark size={compact ? 18 : 26} />
            </span>
          </span>
          {compact ? (
            <span className="relative text-xs font-semibold">Falar com a Bia</span>
          ) : (
            <>
              <span className="relative flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-primary" /> IA · Online
                </span>
                <span className="text-sm font-bold hidden sm:inline">Falar com a Bia</span>
                <span className="text-sm font-bold sm:hidden">Bia</span>
              </span>
              <span className="relative ml-1 h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            </>
          )}
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
              <span className="relative w-full h-full rounded-full bg-[#0a0118] flex items-center justify-center">
                <BiaMark size={28} />
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
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse ml-0.5" />
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
            <div className="flex gap-2 items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder={listening ? "Ouvindo... fale agora" : "Digite ou toque no microfone..."}
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
              />
              {sttSupported && (
                <button
                  onClick={toggleMic}
                  disabled={loading}
                  className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all ${
                    listening
                      ? "bg-destructive text-white animate-pulse shadow-lg shadow-red-500/50"
                      : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                  }`}
                  aria-label={listening ? "Parar gravação" : "Gravar áudio"}
                  title={listening ? "Parar" : "Gravar áudio"}
                >
                  {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
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
              {listening ? "🎙️ Ouvindo... toque no quadrado para parar" : "Atendimento automático com IA"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
