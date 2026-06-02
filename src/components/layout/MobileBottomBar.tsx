import { Bot, MessageCircle, Calculator } from "lucide-react";
import { motion } from "framer-motion";

interface MobileBottomBarProps {
  onOpenAi: () => void;
  onOpenChat: () => void;
  onOpenCalc: () => void;
  chatUnread?: number;
}

export function MobileBottomBar({ onOpenAi, onOpenChat, onOpenCalc, chatUnread = 0 }: MobileBottomBarProps) {
  return (
    <div className="mobile-bottom-bar fixed bottom-0 right-0 left-0 z-40 flex min-h-[56px] border-t pb-[env(safe-area-inset-bottom)] shadow-2xl md:hidden">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onOpenChat}
        className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition-colors hover:text-primary"
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          {chatUnread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold"
            >
              {chatUnread > 9 ? "9+" : chatUnread}
            </motion.span>
          )}
        </div>
        <span className="text-[10px] font-bold leading-none">Chat</span>
      </motion.button>
      <div className="my-2 w-px bg-border/70" />
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onOpenAi}
        className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition-colors hover:text-primary"
      >
        <Bot className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
        <span className="text-[10px] font-bold leading-none">IA</span>
      </motion.button>
      <div className="my-2 w-px bg-border/70" />
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onOpenCalc}
        className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground transition-colors hover:text-primary"
      >
        <Calculator className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
        <span className="text-[10px] font-bold leading-none">Calc</span>
      </motion.button>
    </div>
  );
}
