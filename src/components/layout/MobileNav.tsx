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
import logoImg from "@/assets/logo.png";

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
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
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-xl">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 border-r border-sidebar-border/50 bg-sidebar/95 backdrop-blur-xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <img src={logoImg} alt="Gás Fácil" className="h-10 w-10 rounded-xl shadow-md" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="font-bold text-sidebar-foreground text-[17px] tracking-[-0.03em]">Gás Fácil</h2>
                <p className="text-[9px] font-semibold text-primary/60 uppercase tracking-[0.2em]">ERP Pro</p>
              </motion.div>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto p-2 pb-4 scrollbar-thin">
            <div className="space-y-0.5">
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
                          "group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200",
                          hasActiveChild
                            ? "bg-primary/8 text-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn(
                            "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                            !hasActiveChild && "group-hover:scale-110"
                          )} />
                          <span>{item.label}</span>
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
                            <div className="ml-5 space-y-0.5 border-l-2 border-sidebar-border/40 pl-3 py-1">
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
                                    <Link
                                      to={sub.path}
                                      onClick={() => setOpen(false)}
                                      className={cn(
                                        "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold tracking-[-0.005em] transition-all duration-200",
                                        subActive
                                          ? "bg-primary text-primary-foreground shadow-sm"
                                          : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                                      )}
                                    >
                                      <SubIcon className={cn(
                                        "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                        !subActive && "group-hover:scale-110 group-hover:text-primary"
                                      )} />
                                      <span>{sub.label}</span>
                                    </Link>
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
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200",
                        isActive(item.path!)
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      )}
                    >
                      <Icon className={cn(
                        "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                        !isActive(item.path!) && "group-hover:scale-110"
                      )} />
                      <span>{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </nav>

          {/* User Footer */}
          <div className="flex-shrink-0 border-t border-sidebar-border/50 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/40 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0">
                <span className="text-xs font-bold text-primary">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold tracking-[-0.02em] text-sidebar-foreground truncate">{userName}</p>
                <p className="text-[10px] font-medium text-sidebar-foreground/45 uppercase tracking-wider">Administrador</p>
              </div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-8 w-8 rounded-lg text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10"
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
