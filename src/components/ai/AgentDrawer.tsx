import { useState, useEffect } from "react";
import { Bot, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AiAssistantChat } from "./AiAssistantChat";
import { motion, AnimatePresence } from "framer-motion";

export function AgentDrawer() {
  const [open, setOpen] = useState(false);
  const [hasNewInsight, setHasNewInsight] = useState(false);

  // Pulse for attention on first load
  useEffect(() => {
    const timer = setTimeout(() => setHasNewInsight(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Floating Agent Button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => { setOpen(true); setHasNewInsight(false); }}
              className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 relative group"
              size="icon"
            >
              <Bot className="h-6 w-6 text-primary-foreground" />
              {hasNewInsight && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive animate-pulse flex items-center justify-center">
                  <Sparkles className="h-2.5 w-2.5 text-destructive-foreground" />
                </span>
              )}
              <span className="absolute -top-10 right-0 bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Falar com GásBot
              </span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col gap-0 [&>button]:hidden"
        >
          <SheetHeader className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-primary/10 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold">GásBot Agente</SheetTitle>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">BI + Ações • Powered by IA</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <AiAssistantChat fullPage enableVoice />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
