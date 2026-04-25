import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, X, Volume2, VolumeX, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";
import { cn, getBrasiliaDateString } from "@/lib/utils";

const STORAGE_KEY = "daily-briefing-enabled";
const DISMISSED_KEY = "daily-briefing-dismissed";

export function DailyBriefingWidget() {
  const { unidadeAtual } = useUnidade();
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return false;
    // Dismiss only for today
    return stored === getBrasiliaDateString();
  });
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("Gestor");
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);

  // Ensure voices are loaded
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;
    const loadVoices = () => synth.getVoices();
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
      synth.cancel();
    };
  }, []);

  const speakBriefing = useCallback(() => {
    const synth = synthRef.current;
    if (!synth || !briefing) return;

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    // Clean markdown and emojis for speech
    const clean = briefing
      .replace(/[#*_`~\[\]()>|]/g, "")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{2934}\u{2935}\u{25AA}-\u{25FE}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}]/gu, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    const voices = synth.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;

    synth.speak(utterance);
  }, [briefing, speaking]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Gestor";
        setUserName(name);
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled || dismissed) return;
    fetchBriefing();
  }, [enabled, dismissed, unidadeAtual?.id]);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-briefing", {
        body: { unidade_id: unidadeAtual?.id || null, user_name: userName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBriefing(data.briefing);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro no briefing", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem(STORAGE_KEY, String(val));
    if (!val) {
      setBriefing(null);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, getBrasiliaDateString());
  };

  // Always show the toggle row
  if (!enabled) {
    return (
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <VolumeX className="h-4 w-4" />
          <span>Briefing IA desativado</span>
        </div>
        <Switch checked={false} onCheckedChange={toggleEnabled} />
      </div>
    );
  }

  if (dismissed) {
    return (
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>Briefing minimizado</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDismissed(false); localStorage.removeItem(DISMISSED_KEY); }}>
          Reabrir
        </Button>
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        {briefing && !loading && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", speaking && "text-primary")}
            onClick={speakBriefing}
            title={speaking ? "Parar" : "Ouvir briefing"}
          >
            {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
        )}
        <div className="flex items-center gap-1.5">
          <Switch checked={enabled} onCheckedChange={toggleEnabled} className="scale-75" />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="pt-5 pb-4 pr-24">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10 shrink-0 mt-0.5">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : briefing ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:mb-1.5 [&>ul]:mt-1 [&>ul]:mb-1.5 [&>ul>li]:mb-0.5">
                <ReactMarkdown>{briefing}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Carregando briefing...</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
