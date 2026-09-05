import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  const handleClose = useCallback(() => {
    setOpen(false);
    onExternalClose?.();
  }, [onExternalClose]);

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [handleClose, open]);

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
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 md:p-6"
            role="presentation"
          >
            <Card
              role="dialog"
              aria-modal="true"
              aria-label="Assistente IA"
              className={cn(
                "flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border-0 bg-background shadow-2xl",
                "md:h-[min(720px,calc(100dvh-3rem))] md:w-[min(680px,calc(100vw-3rem))] md:rounded-2xl md:border",
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
                    aria-label="Fechar assistente"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <AiAssistantChat enableVoice />
            </Card>
          </div>,
          document.body,
        )}
    </>
  );
}
