import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save, Volume2 } from "lucide-react";

interface BiaConfig {
  speed: number;
  stability: number;
  similarity_boost: number;
  expressive_mode: boolean;
  prompt: string;
  first_message: string;
  voice_id?: string;
  agent_id?: string;
}

const DEFAULTS: BiaConfig = {
  speed: 0.95,
  stability: 0.45,
  similarity_boost: 0.85,
  expressive_mode: false,
  prompt: "",
  first_message: "",
};

export default function AdminBiaVoz() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<BiaConfig>(DEFAULTS);
  const [original, setOriginal] = useState<BiaConfig>(DEFAULTS);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-update-bia-voice", {
        method: "GET",
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao carregar configuração.");
      const next: BiaConfig = {
        speed: data.tts?.speed ?? DEFAULTS.speed,
        stability: data.tts?.stability ?? DEFAULTS.stability,
        similarity_boost: data.tts?.similarity_boost ?? DEFAULTS.similarity_boost,
        expressive_mode: !!data.tts?.expressive_mode,
        prompt: data.prompt ?? "",
        first_message: data.first_message ?? "",
        voice_id: data.tts?.voice_id,
        agent_id: data.agent_id,
      };
      setConfig(next);
      setOriginal(next);
    } catch (err: any) {
      toast.error("Erro ao carregar Bia", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (config.speed !== original.speed) payload.speed = config.speed;
      if (config.stability !== original.stability) payload.stability = config.stability;
      if (config.similarity_boost !== original.similarity_boost) payload.similarity_boost = config.similarity_boost;
      if (config.expressive_mode !== original.expressive_mode) payload.expressive_mode = config.expressive_mode;
      if (config.prompt !== original.prompt) payload.prompt = config.prompt;
      if (config.first_message !== original.first_message) payload.first_message = config.first_message;

      if (Object.keys(payload).length === 0) {
        toast.info("Nada para salvar — nenhuma alteração.");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("elevenlabs-update-bia-voice", {
        body: payload,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || JSON.stringify(data?.raw));

      toast.success("Bia atualizada!", {
        description: "Faça uma ligação de teste para ouvir.",
      });
      setOriginal(config);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const applyAgentPreset = async (label: string, payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-update-bia-voice", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao aplicar preset");
      toast.success(`Preset '${label}' aplicado!`, { description: "Faça uma ligação de teste." });
      await load();
    } catch (err: any) {
      toast.error("Erro ao aplicar preset", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (preset: "gentle" | "neutral" | "fast" | "lily_jovem" | "brasileira_natural" | "sarah_vapi") => {
    if (preset === "brasileira_natural") {
      return applyAgentPreset("Brasileira Natural (Laura)", {
        voice_id: "FGY2WhTYpPnrIDTdsKH5",
        model_id: "eleven_turbo_v2_5",
        stability: 0.30,
        similarity_boost: 0.80,
        style: 0.55,
        use_speaker_boost: true,
        speed: 1.0,
        optimize_streaming_latency: 3,
        expressive_mode: false,
      });
    }
    if (preset === "sarah_vapi") {
      return applyAgentPreset("Sarah (Vapi-like)", {
        voice_id: "EXAVITQu4vr4xnSDxMaL",
        model_id: "eleven_turbo_v2_5",
        stability: 0.30,
        similarity_boost: 0.80,
        style: 0.55,
        use_speaker_boost: true,
        speed: 1.0,
        optimize_streaming_latency: 3,
        expressive_mode: false,
      });
    }
    if (preset === "gentle") {
      setConfig((c) => ({ ...c, speed: 0.92, stability: 0.40, similarity_boost: 0.85 }));
    } else if (preset === "neutral") {
      setConfig((c) => ({ ...c, speed: 1.0, stability: 0.5, similarity_boost: 0.8 }));
    } else if (preset === "fast") {
      setConfig((c) => ({ ...c, speed: 1.08, stability: 0.5, similarity_boost: 0.8 }));
    } else if (preset === "lily_jovem") {
      // Aplica preset jovem + natural + baixa latência diretamente no agente
      setSaving(true);
      try {
        const { data, error } = await supabase.functions.invoke("elevenlabs-update-bia-voice", {
          body: {
            voice_id: "pFZP5JQG7iQjIQuC4Bku", // Lily
            model_id: "eleven_flash_v2_5",
            speed: 1.02,
            stability: 0.35,
            similarity_boost: 0.75,
            style: 0.45,
            use_speaker_boost: true,
            optimize_streaming_latency: 3,
            expressive_mode: false,
          },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Falha ao aplicar preset");
        toast.success("Preset 'Lily Jovem' aplicado!", { description: "Faça uma ligação de teste." });
        await load();
      } catch (err: any) {
        toast.error("Erro ao aplicar preset", { description: err?.message });
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Volume2 className="h-6 w-6 text-primary" />
            Voz da Bia
          </h1>
          <p className="text-sm text-muted-foreground">
            Calibre tom, velocidade e mensagem inicial da assistente que atende ligações.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Recarregar
          </Button>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voz (TTS)</CardTitle>
          <CardDescription>
            Voz: {config.voice_id} · Agente: {config.agent_id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => applyPreset("gentle")}>
              Preset: Gentil & calma
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset("neutral")}>
              Preset: Neutra
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset("fast")}>
              Preset: Rápida (antiga)
            </Button>
            <Button variant="default" size="sm" onClick={() => applyPreset("brasileira_natural")} disabled={saving}>
              🇧🇷 Brasileira Natural (Laura)
            </Button>
            <Button variant="default" size="sm" onClick={() => applyPreset("sarah_vapi")} disabled={saving}>
              ✨ Sarah (Vapi-like)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset("lily_jovem")} disabled={saving}>
              ⚡ Lily Jovem
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Velocidade (speed)</Label>
              <span className="text-sm font-mono text-muted-foreground">{config.speed.toFixed(2)}</span>
            </div>
            <Slider
              min={0.7}
              max={1.2}
              step={0.01}
              value={[config.speed]}
              onValueChange={([v]) => setConfig((c) => ({ ...c, speed: v }))}
            />
            <p className="text-xs text-muted-foreground">
              0.90 = bem calma · 1.00 = natural · 1.10 = corrida.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Estabilidade (stability)</Label>
              <span className="text-sm font-mono text-muted-foreground">{config.stability.toFixed(2)}</span>
            </div>
            <Slider
              min={0.2}
              max={0.9}
              step={0.05}
              value={[config.stability]}
              onValueChange={([v]) => setConfig((c) => ({ ...c, stability: v }))}
            />
            <p className="text-xs text-muted-foreground">
              Menor = mais variação emocional (mais humana). Maior = mais monótona/constante.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Similaridade (similarity_boost)</Label>
              <span className="text-sm font-mono text-muted-foreground">{config.similarity_boost.toFixed(2)}</span>
            </div>
            <Slider
              min={0.3}
              max={1.0}
              step={0.05}
              value={[config.similarity_boost]}
              onValueChange={([v]) => setConfig((c) => ({ ...c, similarity_boost: v }))}
            />
            <p className="text-xs text-muted-foreground">
              Quão fiel à voz original (Sarah). 0.85 costuma soar mais acolhedor.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Modo expressivo</Label>
              <p className="text-xs text-muted-foreground">
                Adiciona emoção mas pode aumentar latência no telefone.
              </p>
            </div>
            <Switch
              checked={config.expressive_mode}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, expressive_mode: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saudação inicial</CardTitle>
          <CardDescription>Primeira frase que a Bia fala ao atender.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={config.first_message}
            onChange={(e) => setConfig((c) => ({ ...c, first_message: e.target.value }))}
            placeholder="Oi, tudo bem? Aqui é a Bia da Central Gás..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personalidade & instruções (system prompt)</CardTitle>
          <CardDescription>
            Texto completo que define como a Bia se comporta. Cuidado ao editar — manter as regras críticas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.prompt}
            onChange={(e) => setConfig((c) => ({ ...c, prompt: e.target.value }))}
            rows={20}
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
