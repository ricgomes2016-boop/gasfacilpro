import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  Menu,
  ChevronDown,
  X,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { menuItems } from "./menuItems";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

const menuIconColors: Record<string, string> = {
  "Dashboard": "text-sidebar-foreground",
  "Assistente IA": "text-sidebar-foreground",
  "Atendimento": "text-sidebar-foreground",
  "Vendas": "text-sidebar-foreground",
  "Caixa": "text-sidebar-foreground",
  "Gestão Operacional": "text-sidebar-foreground",
  "Gestão de Clientes": "text-sidebar-foreground",
  "Gestão de Estoque": "text-sidebar-foreground",
  "Gestão Financeira": "text-sidebar-foreground",
  "Gestão de Frota": "text-sidebar-foreground",
  "Gestão de RH": "text-sidebar-foreground",
  "Gestão Fiscal": "text-sidebar-foreground",
  "Marketing": "text-sidebar-foreground",
  "Configurações": "text-sidebar-foreground/80",
};

const subMenuIconColors: Record<string, string> = new Proxy({}, {
  get: () => "text-sidebar-foreground/85",
}) as Record<string, string>;

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { themeClass, brandTheme } = useDashboardTheme();
  const [open, setOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Auto-open active submenu
  useEffect(() => {
    if (open) {
      menuItems.forEach((item) => {
        if (item.submenu?.some((sub) => location.pathname === sub.path)) {
          setOpenMenus((prev) =>
            prev.includes(item.label) ? prev : [...prev, item.label]
          );
        }
      });
    }
  }, [open, location.pathname]);

  // Allow other components (e.g., MobileBottomBar) to open the drawer
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("mobile-nav:open", handler);
    return () => window.removeEventListener("mobile-nav:open", handler);
  }, []);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
    setOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const userName = profile?.full_name || "Administrador";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden h-9 w-9 rounded-xl">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className={cn(themeClass, "app-sidebar-premium app-mobile-sidebar-modern w-[min(86vw,320px)] overflow-hidden rounded-r-[1.75rem] border-r border-sidebar-border/15 p-0 text-sidebar-foreground shadow-2xl")}>
        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="flex h-20 items-center justify-center border-b border-sidebar-border/15 px-5 py-3">
            <div className="flex min-w-0 items-center justify-center gap-3">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="shrink-0"
              >
                <img src={brandTheme.logoMark} alt="Gás Fácil" className="h-12 w-12 shrink-0 object-contain" />
              </motion.div>
              <div className="flex min-w-0 flex-col justify-center leading-none">
                <span className="truncate text-[16px] font-extrabold tracking-[-0.03em] text-sidebar-foreground">
                  Gas Facil
                </span>
                <span className="mt-1 inline-flex w-fit rounded-full bg-sidebar-accent/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-sidebar-foreground/80 ring-1 ring-sidebar-border/20">
                  ERP PRO
                </span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto px-3.5 py-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2">
              {menuItems.map((item, idx) => {
                const Icon = item.icon;
                const hasSubmenu = !!item.submenu;
                const isSubmenuOpen = openMenus.includes(item.label);
                const hasActiveChild = item.submenu?.some((sub) => isActive(sub.path));

                if (hasSubmenu) {
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                    >
                      <button
                        onClick={() => toggleMenu(item.label)}
                        className={cn(
                          "group flex w-full items-center justify-between rounded-full px-4 py-3.5 text-[13px] font-semibold tracking-normal transition-all duration-200",
                          hasActiveChild
                            ? "gradient-primary text-primary-foreground shadow-lg shadow-foreground/10 ring-1 ring-sidebar-border/25"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground hover:ring-1 hover:ring-sidebar-border/15"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn(
                            "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                            !hasActiveChild && "group-hover:scale-110",
                            !hasActiveChild && (menuIconColors[item.label] || "")
                          )} />
                          <span className="min-w-0 truncate">{item.label}</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isSubmenuOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </motion.div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isSubmenuOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="ml-6 mt-2 space-y-1.5 border-l border-sidebar-border/20 py-1.5 pl-3">
                              {item.submenu?.map((sub, subIdx) => {
                                const SubIcon = sub.icon;
                                const subActive = isActive(sub.path);
                                return (
                                  <motion.div
                                    key={sub.path}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: subIdx * 0.02, duration: 0.15 }}
                                  >
                                    {sub.externalUrl ? (
                                      <a
                                        href={sub.externalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setOpen(false)}
                                        className="group flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[12px] font-bold transition-all duration-200 text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground hover:ring-1 hover:ring-sidebar-border/15"
                                      >
                                        <SubIcon className={cn(
                                          "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                          "group-hover:scale-110",
                                          subMenuIconColors[sub.label] || ""
                                        )} />
                                        <span className="min-w-0 truncate">{sub.label}</span>
                                      </a>
                                    ) : (
                                      <Link
                                        to={sub.path!}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                          "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold tracking-[-0.005em] transition-all duration-200",
                                          subActive
                                            ? "gradient-primary text-primary-foreground shadow-sm ring-1 ring-sidebar-border/25"
                                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground hover:ring-1 hover:ring-sidebar-border/15"
                                        )}
                                      >
                                        <SubIcon className={cn(
                                          "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                          !subActive && "group-hover:scale-110",
                                          !subActive && (subMenuIconColors[sub.label] || "")
                                        )} />
                                        <span className="min-w-0 truncate">{sub.label}</span>
                                      </Link>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02, duration: 0.2 }}
                  >
                    <Link
                      to={item.path!}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3.5 rounded-full px-4 py-3.5 text-[13px] font-semibold tracking-normal transition-all duration-200",
                        isActive(item.path!)
                          ? "gradient-primary text-primary-foreground shadow-lg shadow-foreground/10 ring-1 ring-sidebar-border/25"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground hover:ring-1 hover:ring-sidebar-border/15"
                      )}
                    >
                      <Icon className={cn(
                        "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                        !isActive(item.path!) && "group-hover:scale-110",
                        !isActive(item.path!) && (menuIconColors[item.label] || "")
                      )} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </nav>

          {/* User Footer */}
          <div className="flex-shrink-0 border-t border-sidebar-border/15 bg-sidebar-accent/5 p-3">
            <div className="flex items-center gap-3 rounded-3xl border border-sidebar-border/15 bg-sidebar-accent/10 p-3 shadow-none backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/90 flex-shrink-0 shadow-sm shadow-foreground/10">
                <span className="text-xs font-bold text-sidebar-accent-foreground">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-sidebar-foreground truncate">{userName}</p>
                <p className="text-[10px] font-bold text-sidebar-foreground uppercase tracking-wider">Administrador</p>
              </div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-8 w-8 rounded-lg text-sidebar-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
