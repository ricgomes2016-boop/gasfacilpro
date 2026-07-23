import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ScanLine,
  ShoppingCart,
  ClipboardList,
  Menu,
  Bot,
  MessageCircle,
  Calculator,
  Plus,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MobileBottomBarProps {
  onOpenAi: () => void;
  onOpenChat: () => void;
  onOpenCalc: () => void;
  chatUnread?: number;
}

const navItems = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/vendas/pdv", label: "PDV", icon: ScanLine },
  { to: "/vendas/nova-venda", label: "Nova", icon: ShoppingCart, primary: true },
  { to: "/vendas/pedidos", label: "Pedidos", icon: ClipboardList },
] as const;

function openMobileMenu() {
  window.dispatchEvent(new CustomEvent("mobile-nav:open"));
}

export function MobileBottomBar({
  onOpenAi,
  onOpenChat,
  onOpenCalc,
  chatUnread = 0,
}: MobileBottomBarProps) {
  const location = useLocation();
  const [fabOpen, setFabOpen] = useState(false);

  const isActive = (to: string) =>
    to === "/dashboard"
      ? location.pathname === "/dashboard" || location.pathname === "/"
      : location.pathname.startsWith(to);

  return (
    <div className="mobile-bottom-bar fixed bottom-0 right-0 left-0 z-40 pointer-events-none md:hidden">
      {/* Utility FAB cluster — Chat / IA / Calc */}
      <div className="pointer-events-none absolute right-3 z-10 flex flex-col items-end gap-2 bottom-[calc(env(safe-area-inset-bottom)+76px)]">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-auto flex flex-col items-end gap-2"
            >
              <FabItem
                label="Chat"
                icon={MessageCircle}
                badge={chatUnread}
                onClick={() => {
                  setFabOpen(false);
                  onOpenChat();
                }}
              />
              <FabItem
                label="IA"
                icon={Bot}
                onClick={() => {
                  setFabOpen(false);
                  onOpenAi();
                }}
              />
              <FabItem
                label="Calc"
                icon={Calculator}
                onClick={() => {
                  setFabOpen(false);
                  onOpenCalc();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => setFabOpen((v) => !v)}
          aria-label={fabOpen ? "Fechar utilitários" : "Abrir utilitários"}
          className={cn(
            "pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/20",
            "transition-transform"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {fabOpen ? (
              <motion.span
                key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-5 w-5" />
              </motion.span>
            ) : (
              <motion.span
                key="plus"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Plus className="h-5 w-5" />
              </motion.span>
            )}
          </AnimatePresence>
          {!fabOpen && chatUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background flex items-center justify-center">
              {chatUnread > 9 ? "9+" : chatUnread}
            </span>
          )}
        </motion.button>
      </div>

      {/* Primary bottom navigation */}
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto border-t border-border/60 bg-card/95 px-2 pt-1 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.15)] backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="mx-auto flex max-w-xl items-stretch justify-between gap-0.5">
          {navItems.map((item) => (
            <NavButton
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={isActive(item.to)}
              primary={"primary" in item && item.primary}
            />
          ))}
          <MenuButton onClick={openMobileMenu} />
        </div>
      </nav>
    </div>
  );
}

interface NavButtonProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  primary?: boolean;
}

function NavButton({ to, icon: Icon, label, active, primary }: NavButtonProps) {
  return (
    <NavLink
      to={to}
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5",
        "transition-colors duration-150",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
      )}
      <span
        className={cn(
          "flex items-center justify-center rounded-xl transition-all",
          primary
            ? "h-10 w-10 -mt-3 bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-4 ring-background"
            : "h-8 w-8",
          active && !primary && "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            primary ? "h-5 w-5" : "h-[20px] w-[20px]",
            "transition-transform group-active:scale-90"
          )}
        />
      </span>
      <span
        className={cn(
          "text-[10px] font-semibold leading-none tracking-tight",
          primary && "mt-0.5"
        )}
      >
        {label}
      </span>
    </NavLink>
  );
}

function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir menu"
      className={cn(
        "group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5",
        "text-muted-foreground transition-colors duration-150 hover:text-foreground"
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl">
        <Menu className="h-[20px] w-[20px] transition-transform group-active:scale-90" />
      </span>
      <span className="text-[10px] font-semibold leading-none tracking-tight">Menu</span>
    </button>
  );
}

interface FabItemProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: number;
}

function FabItem({ label, icon: Icon, onClick, badge = 0 }: FabItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-md ring-1 ring-border/60">
        {label}
      </span>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        aria-label={label}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-md ring-1 ring-border/60 hover:bg-primary/5 hover:text-primary"
      >
        <Icon className="h-[18px] w-[18px]" />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </motion.button>
    </div>
  );
}
