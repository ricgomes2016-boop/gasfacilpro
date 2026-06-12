import { useState, useEffect } from "react";
import { Bot, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AiAssistantChat } from "./AiAssistantChat";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AiFloatingButtonProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function AiFloatingButton({ externalOpen, onExternalClose }: AiFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    onExternalClose?.();
  };

  return (
    <>
      {/* Desktop floating button (hidden on mobile - mobile uses bottom bar) */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="hidden md:flex fixed bottom-6 right-6 xl:bottom-24 z-40 h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90"
          title="Abrir Assistente IA"
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}

      {/* Chat panel */}
      {open && (
        <Card className={cn(
          "fixed z-50 shadow-2xl border flex flex-col overflow-hidden bg-background",
          // Mobile: full width sheet above bottom bar
          "left-2 right-2 bottom-[72px] h-[70svh] max-h-[calc(100svh-96px)] rounded-2xl",
          // Desktop: fixed panel at bottom-right, above floating chat bubble
          "md:left-auto md:right-6 md:bottom-24 md:w-[400px] md:h-[560px] md:max-h-[calc(100vh-8rem)] md:rounded-xl",
          "xl:bottom-28"
        )}>

          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5 rounded-t-2xl md:rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Assistente IA</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { handleClose(); navigate("/assistente-ia"); }}
                title="Abrir página completa"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <AiAssistantChat enableVoice />
        </Card>
      )}
    </>
  );
}
