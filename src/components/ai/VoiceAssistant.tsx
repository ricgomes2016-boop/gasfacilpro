import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Volume2, VolumeX, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

interface VoiceAssistantProps {
  userName?: string;
}

export function VoiceAssistant({ userName = "Gestor" }: VoiceAssistantProps) {
  const { unidadeAtual } = useUnidade();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [open, setOpen] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Ensure voices are loaded before trying to speak
  useEffect(() => {
    const synth = synthRef.current;
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) setVoicesLoaded(true);
    };
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
      recognitionRef.current?.abort();
      synth.cancel();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    // Strip markdown for speech
    const clean = text
      .replace(/[#*_`~\[\]()>|]/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return;

    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    // Pick a PT-BR voice if available
    const voices = synthRef.current.getVoices();
    const ptVoice = voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;

    synthRef.current.speak(utterance);
  }, [stopSpeaking]);

  const sendToAI = useCallback(async (text: string) => {
    setProcessing(true);
    setResponse("");

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          unidade_id: unidadeAtual?.id || null,
        }),
      });

      if (!resp.ok) {
        throw new Error("Erro na comunicação");
      }

      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Speak the response
      if (fullResponse) {
        // Remove CHART_META blocks from speech
        const speechText = fullResponse.replace(/\[CHART_META\].*?\[\/CHART_META\]/s, "");
        speak(speechText);
      }
    } catch (e: any) {
      console.error("Voice AI error:", e);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }, [unidadeAtual?.id, speak]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast({ title: "Não suportado", description: "Seu navegador não suporta reconhecimento de voz.", variant: "destructive" });
      return;
    }

    stopSpeaking();
    setTranscript("");
    setResponse("");

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
    };

    recognition.onend = () => {
      setListening(false);
      // Get final transcript
      const finalTranscript = (recognition as any).__lastTranscript;
      if (finalTranscript?.trim()) {
        sendToAI(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
      if (event.error === "not-allowed") {
        toast({ title: "Microfone bloqueado", description: "Permita o acesso ao microfone nas configurações do navegador.", variant: "destructive" });
      }
    };

    // Track transcript for onend
    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const text = final || interim;
      setTranscript(text);
      (recognition as any).__lastTranscript = final || text;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setOpen(true);
  }, [isSupported, sendToAI, stopSpeaking]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  if (!isSupported) return null;

  if (!open) {
    return (
      <Button
        onClick={startListening}
        size="icon"
        variant="outline"
        className="h-10 w-10 rounded-full border-primary/30 hover:bg-primary/10"
        title="Assistente de Voz"
      >
        <Mic className="h-5 w-5 text-primary" />
      </Button>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mic className="h-4 w-4 text-primary" />
            Assistente de Voz
          </div>
          <div className="flex items-center gap-1">
            {speaking && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stopSpeaking}>
                <VolumeX className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { stopSpeaking(); stopListening(); setOpen(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mic button */}
        <div className="flex justify-center">
          <button
            onClick={listening ? stopListening : startListening}
            disabled={processing}
            className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center transition-all",
              listening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : processing
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {processing ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : listening ? (
              <MicOff className="h-7 w-7" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </button>
        </div>

        {/* Status */}
        <p className="text-center text-xs text-muted-foreground">
          {listening ? "Ouvindo... toque para parar" : processing ? "Processando..." : speaking ? "Falando..." : "Toque para falar"}
        </p>

        {/* Transcript */}
        {transcript && (
          <div className="rounded-lg bg-muted p-2 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Você disse:</p>
            <p>{transcript}</p>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm max-h-48 overflow-y-auto">
            <div className="flex items-center gap-1 mb-1">
              <Volume2 className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">Assistente:</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{response.replace(/\[CHART_META\].*?\[\/CHART_META\]/s, "")}</ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
