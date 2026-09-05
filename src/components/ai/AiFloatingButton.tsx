import { useState, useEffect } from "react";
import { Bot, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AiAssistantChat } from "./AiAssistantChat";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  PortalToId,
  FOOTER_ACTIONS_ID,
} from "@/components/layout/footerPortals";
import { useUnidade } from "@/contexts/UnidadeContext";

interface AiFloatingButtonProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function AiFloatingButton({
  externalOpen,
  onExternalClose,
}: AiFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    onExternalClose?.();
  };

  return (
    <>
      {/* Desktop trigger lives inside the fixed SystemFooter (mobile uses bottom bar) */}
      {!open && (
        <PortalToId id={FOOTER_ACTIONS_ID}>
          <Button
            onClick={() => setOpen(true)}
            size="icon"
            className="h-8 w-8 rounded-full shadow-md bg-primary hover:bg-primary/90"
            title="Abrir Assistente IA"
          >
            <Bot className="h-4 w-4" />
          </Button>
        </PortalToId>
      )}

      {/* Chat panel */}
      {open && (
        <Card
          className={cn(
            "fixed z-50 shadow-2xl border flex flex-col overflow-hidden bg-background",
            // Mobile: true full-screen assistant; the composer remains above the virtual keyboard.
            "inset-0 h-[100dvh] w-full rounded-none border-0",
            // Desktop: fixed panel at bottom-right, above floating chat bubble
            "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(680px,calc(100vw-3rem))] md:h-[min(720px,calc(100vh-4rem))] md:max-h-none md:rounded-2xl md:border",
          )}
        >
          <div className="flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b bg-primary/5 md:pt-3 md:rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <span className="block font-semibold text-sm">
                  Assistente IA
                </span>
                <span className="block max-w-[210px] truncate text-[11px] text-muted-foreground">
                  {unidadeAtual?.nome || "Selecione uma unidade"}
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  handleClose();
                  navigate("/assistente-ia");
                }}
                title="Abrir página completa"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClose}
              >
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
