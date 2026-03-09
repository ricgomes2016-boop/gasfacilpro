import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Speech-to-Text (STT) via Web Speech API ────────────────────────────────

interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({ onResult, disabled, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, onResult]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleListening}
      disabled={disabled}
      className={cn(
        "shrink-0 relative",
        isListening && "text-destructive",
        className,
      )}
      title={isListening ? "Parar gravação" : "Falar com voz"}
    >
      {isListening ? (
        <>
          <MicOff className="h-4 w-4" />
          <span className="absolute inset-0 rounded-md border-2 border-destructive/50 animate-pulse" />
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}

// ─── Text-to-Speech (TTS) via SpeechSynthesis ───────────────────────────────

interface TtsButtonProps {
  text: string;
  className?: string;
}

export function TtsButton({ text, className }: TtsButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeak = useCallback(() => {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip markdown
    const clean = text
      .replace(/\[CHART_META\].*?\[\/CHART_META\]/gs, "")
      .replace(/[#*_`~\[\]()>|]/g, "")
      .replace(/\n+/g, ". ")
      .slice(0, 2000);

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1;

    // Try to find a good pt-BR voice
    const voices = speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith("pt-BR")) || voices.find(v => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [text, isSpeaking]);

  if (!("speechSynthesis" in window)) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 opacity-50 hover:opacity-100", isSpeaking && "text-primary opacity-100", className)}
      onClick={toggleSpeak}
      title={isSpeaking ? "Parar narração" : "Ouvir resposta"}
    >
      {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
    </Button>
  );
}
