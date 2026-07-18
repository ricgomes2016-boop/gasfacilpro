import { Bot, MessageCircle, Calculator } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MobileBottomBarProps {
  onOpenAi: () => void;
  onOpenChat: () => void;
  onOpenCalc: () => void;
  chatUnread?: number;
}

interface BarItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: number;
}

function BarItem({ icon: Icon, label, onClick, badge = 0 }: BarItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2",
        "text-muted-foreground transition-colors duration-200 hover:text-primary active:text-primary"
      )}
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent transition-colors duration-200 group-hover:bg-primary/10 group-active:bg-primary/15">
        <Icon className="h-[22px] w-[22px] transition-transform duration-200 group-active:scale-110" />
        {badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold shadow-sm ring-2 ring-background"
          >
            {badge > 9 ? "9+" : badge}
          </motion.span>
        )}
      </div>
      <span className="text-[10px] font-semibold leading-none tracking-tight">{label}</span>
    </motion.button>
  );
}

export function MobileBottomBar({ onOpenAi, onOpenChat, onOpenCalc, chatUnread = 0 }: MobileBottomBarProps) {
  return (
    <div className="mobile-bottom-bar fixed bottom-0 right-0 left-0 z-40 pointer-events-none px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 md:hidden">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-md items-center gap-1 rounded-[28px]",
          "border border-border/50 bg-card/95 px-2 py-1.5 shadow-[0_10px_40px_-10px_rgba(15,23,42,0.25)]",
          "backdrop-blur-xl backdrop-saturate-150"
        )}
      >
        <BarItem icon={MessageCircle} label="Chat" onClick={onOpenChat} badge={chatUnread} />
        <BarItem icon={Bot} label="IA" onClick={onOpenAi} />
        <BarItem icon={Calculator} label="Calc" onClick={onOpenCalc} />
      </div>
    </div>
  );
}
