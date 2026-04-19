import { useCallback, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, X, Sparkles, PhoneOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import biaAvatar from "@/assets/bia-avatar.png";

interface BiaAvatarSiteProps {
  /** Cor de glow em volta do avatar (Tailwind). Ex: "shadow-orange-500/50" */
  glowClass?: string;
  /** Classes do gradiente principal. */
  gradient?: string;
  /** Posição. Default: bottom-24 (acima do whatsapp) right-6. */
  positionClass?: string;
}

export function BiaAvatarSite({
  glowClass = "shadow-orange-500/50",
  gradient = "from-orange-500 via-fuchsia-500 to-purple-600",
  positionClass = "fixed bottom-44 right-6 z-50",
}: BiaAvatarSiteProps) {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState<string>("");
  const [agentTranscript, setAgentTranscript] = useState<string>("");

  const conversation = useConversation({
    onConnect: () => {
      setErrorMsg(null);
      console.log("[Bia] conectada");
    },
    onDisconnect: () => console.log("[Bia] desconectada"),
    onError: (e: any) => {
      console.error("[Bia] erro:", e);
      setErrorMsg("Tive uma instabilidade. Tente novamente.");
    },
    onMessage: (msg: any) => {
      // Tipos vindos do SDK podem variar; tentamos os mais comuns
      if (msg?.source === "user" && msg?.message) {
        setUserTranscript(msg.message);
      } else if (msg?.source === "ai" && msg?.message) {
        setAgentTranscript(msg.message);
      }
    },
  });

  const status = conversation.status; // "connected" | "disconnected" | "connecting"
  const isSpeaking = conversation.isSpeaking;
  const isConnected = status === "connected";

  const start = useCallback(async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      // Pede permissão do microfone
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Busca token efêmero da edge function
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
      );
      if (error) throw error;
      if (!data?.token || !data?.agentId) {
        throw new Error("Token inválido");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      } as any);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e?.message?.includes("Permission")
          ? "Permita o acesso ao microfone para falar com a Bia."
          : "Não consegui conectar. Tente novamente em instantes.",
      );
    } finally {
      setConnecting(false);
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      console.error(e);
    }
  }, [conversation]);

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Falar com a Bia por voz"
          className={`${positionClass} group flex items-center gap-3 pl-2 pr-4 py-2 rounded-full bg-[#0a0118]/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl ${glowClass} hover:scale-[1.04] transition-all`}
        >
          <span
            className={`pointer-events-none absolute -inset-1 rounded-full bg-gradient-to-r ${gradient} opacity-50 blur-xl group-hover:opacity-80 transition-opacity`}
          />
          <span className="relative w-11 h-11 rounded-full p-[2px] overflow-hidden">
            <span
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                animationDuration: "5s",
                background:
                  "conic-gradient(from 0deg, #fb923c, #e879f9, #a78bfa, #2dd4bf, #fb923c)",
              }}
            />
            <span className="relative w-full h-full rounded-full bg-[#0a0118] overflow-hidden flex items-center justify-center">
              <img src={biaAvatar} alt="Bia" className="w-full h-full object-cover" />
            </span>
          </span>
          <span className="relative flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-orange-300" /> Voz · IA
            </span>
            <span className="text-sm font-bold">Falar com a Bia</span>
          </span>
        </button>
      )}

      {/* Card */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[380px] bg-[#0a0118] border border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className={`relative bg-gradient-to-r ${gradient} px-4 py-3 flex items-center gap-3`}>
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 60%)",
              }}
            />
            <div className="relative text-white flex-1">
              <div className="font-bold leading-tight tracking-tight">Bia · Forte Gás</div>
              <div className="text-[11px] flex items-center gap-1.5 opacity-95 mt-0.5">
                <Sparkles className="w-3 h-3" />
                <span className="uppercase tracking-wider font-semibold">
                  {isConnected ? (isSpeaking ? "Falando…" : "Ouvindo…") : "Conversa por voz"}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
                    isConnected ? "bg-emerald-300 animate-pulse" : "bg-white/40"
                  }`}
                />
              </div>
            </div>
            <button
              onClick={async () => {
                await stop();
                setOpen(false);
              }}
              className="text-white/80 hover:text-white p-1"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Avatar + estado */}
          <div className="flex flex-col items-center justify-center py-6 px-4 bg-[#0a0118]">
            <div className="relative w-40 h-40">
              {/* Anéis pulsantes quando falando */}
              {isSpeaking && (
                <>
                  <span className={`absolute inset-0 rounded-full bg-gradient-to-r ${gradient} opacity-30 animate-ping`} />
                  <span className={`absolute -inset-3 rounded-full bg-gradient-to-r ${gradient} opacity-20 animate-pulse`} />
                </>
              )}
              {/* Anel rotativo sempre que conectada */}
              {isConnected && (
                <span
                  className="absolute -inset-1 rounded-full animate-spin"
                  style={{
                    animationDuration: "6s",
                    background:
                      "conic-gradient(from 0deg, #fb923c, #e879f9, #a78bfa, #2dd4bf, #fb923c)",
                  }}
                />
              )}
              <div className="relative w-full h-full rounded-full overflow-hidden bg-[#0a0118] border-2 border-white/10">
                <img src={biaAvatar} alt="Bia" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Transcrições */}
            <div className="w-full mt-5 space-y-2 min-h-[60px]">
              {userTranscript && (
                <div className="text-xs text-white/60">
                  <span className="font-semibold text-white/80">Você:</span> {userTranscript}
                </div>
              )}
              {agentTranscript && (
                <div className="text-sm text-white">
                  <span className="font-semibold text-orange-300">Bia:</span> {agentTranscript}
                </div>
              )}
              {!isConnected && !connecting && !errorMsg && (
                <div className="text-center text-sm text-white/60 px-2">
                  Toque em <span className="text-white font-semibold">Falar com a Bia</span> e
                  fale naturalmente — ela responde por voz em tempo real.
                </div>
              )}
              {errorMsg && (
                <div className="text-center text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>

          {/* Controles */}
          <div className="border-t border-white/10 p-3 bg-[#0a0118] flex items-center gap-2">
            {!isConnected ? (
              <button
                onClick={start}
                disabled={connecting}
                className={`flex-1 h-12 rounded-full bg-gradient-to-r ${gradient} text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] transition-transform`}
              >
                {connecting ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-bounce" />
                    Conectando…
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> Falar com a Bia
                  </>
                )}
              </button>
            ) : (
              <>
                <div className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-white/5 border border-white/10 text-white text-sm">
                  {isSpeaking ? (
                    <>
                      <Volume2 className="w-4 h-4 text-orange-300 animate-pulse" />
                      Bia está falando…
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-emerald-300" />
                      Pode falar
                    </>
                  )}
                </div>
                <button
                  onClick={stop}
                  className="h-12 w-12 shrink-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                  aria-label="Encerrar"
                  title="Encerrar"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className="text-[10px] text-white/30 text-center pb-2 px-3 bg-[#0a0118]">
            Atendimento por voz com IA · pode falar normalmente
          </div>
        </div>
      )}
    </>
  );
}

export default BiaAvatarSite;
