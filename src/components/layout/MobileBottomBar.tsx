import { Bot, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

interface MobileBottomBarProps {
  onOpenAi: () => void;
  onOpenChat: () => void;
  chatUnread?: number;
}

export function MobileBottomBar({ onOpenAi, onOpenChat, chatUnread = 0 }: MobileBottomBarProps) {
  return (
    <div className="fixed bottom-0 right-0 left-0 z-40 flex border-t border-border/50 bg-background/80 backdrop-blur-xl md:hidden">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onOpenChat}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground hover:text-primary transition-colors relative group"
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
        <span className="text-[10px] font-semibold tracking-wide">Chat</span>
      </motion.button>
      <div className="w-px bg-border/50 my-2" />
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onOpenAi}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground hover:text-primary transition-colors group"
      >
        <Bot className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
        <span className="text-[10px] font-semibold tracking-wide">IA</span>
      </motion.button>
    </div>
  );
}
