import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, FileUp, Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SmartImportButtonsProps {
  edgeFunctionName: string;
  onDataExtracted: (data: any) => void;
  disabled?: boolean;
  className?: string;
}

const compressImage = (file: File, maxWidth = 1600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function SmartImportButtons({ edgeFunctionName, onDataExtracted, disabled, className }: SmartImportButtonsProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const [processing, setProcessing] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setProcessing(true);
    try {
      const base64 = await compressImage(file);
      const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onDataExtracted(data);
    } catch (err: any) {
      console.error("Erro OCR:", err);
      toast.error(err.message || "Erro ao processar imagem");
    } finally {
      setProcessing(false);
    }
  };

  const handlePdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setProcessing(true);
    try {
      // Convert PDF first page to image via canvas
      const arrayBuffer = await file.arrayBuffer();
      const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
        body: { imageBase64: `data:application/pdf;base64,${base64Pdf}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onDataExtracted(data);
    } catch (err: any) {
      console.error("Erro PDF:", err);
      toast.error(err.message || "Erro ao processar PDF");
    } finally {
      setProcessing(false);
    }
  };

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Navegador não suporta reconhecimento de voz"); return; }

    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => { setListening(true); setVoiceText(""); };
    recognition.onresult = (event: any) => {
      let t = "";
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript;
      setVoiceText(t);
    };
    recognition.onend = async () => {
      setListening(false);
      const finalText = voiceText || "";
      if (finalText.trim().length < 3) return;

      setProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
          body: { text: finalText, mode: "voice" },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        onDataExtracted(data);
        toast.success("Dados extraídos por voz!");
      } catch (err: any) {
        console.error("Erro voz:", err);
        toast.error(err.message || "Erro ao processar comando de voz");
      } finally {
        setProcessing(false);
      }
    };
    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error === "not-allowed") toast.error("Permissão de microfone negada");
      else if (event.error !== "aborted") toast.error("Erro no reconhecimento de voz");
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const isDisabled = disabled || processing;

  return (
    <div className={`flex gap-1.5 ${className || ""}`}>
      <Button
        variant="photo" size="icon"
        onClick={() => cameraInputRef.current?.click()}
        disabled={isDisabled}
        title="Tirar foto"
        className="h-9 w-9"
      >
        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </Button>
      <Button
        variant="import" size="icon"
        onClick={() => photoInputRef.current?.click()}
        disabled={isDisabled}
        title="Importar imagem"
        className="h-9 w-9"
      >
        <FileUp className="h-4 w-4" />
      </Button>
      <Button
        variant="pdf" size="icon"
        onClick={() => pdfInputRef.current?.click()}
        disabled={isDisabled}
        title="Importar PDF"
        className="h-9 w-9"
      >
        <span className="text-[10px] font-bold">PDF</span>
      </Button>
      <Button
        variant={listening ? "destructive" : "microphone"} size="icon"
        onClick={listening ? stopVoice : startVoice}
        disabled={processing}
        title={listening ? "Parar gravação" : "Comando de voz"}
        className={`h-9 w-9 ${listening ? "animate-pulse" : ""}`}
      >
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>

      {/* Hidden inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageFile} className="hidden" />
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfFile} className="hidden" />

      {listening && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          🔴 Ouvindo...
        </span>
      )}
      {processing && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          Processando...
        </span>
      )}
    </div>
  );
}
