import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Store,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useState, useEffect } from "react";
import { menuItems } from "./menuItems";
import { motion, AnimatePresence } from "framer-motion";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebarContext();
  const { signOut, profile } = useAuth();
  const { unidades, unidadeAtual, setUnidadeAtual } = useUnidade();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Auto-open active submenu
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.submenu?.some((sub) => location.pathname === sub.path)) {
        setOpenMenus((prev) =>
          prev.includes(item.label) ? prev : [...prev, item.label]
        );
      }
    });
  }, [location.pathname]);

  const toggleSubmenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isSubmenuOpen = (label: string) => openMenus.includes(label);
  const isActive = (path?: string) => path && location.pathname === path;
  const isSubmenuActive = (submenu?: { label: string; path: string }[]) =>
    submenu?.some((item) => location.pathname === item.path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const userName = profile?.full_name || "Administrador";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        animate={{ width: collapsed ? 64 : 260 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed left-0 top-0 z-40 hidden md:flex h-screen flex-col bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border/50"
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border/50 px-3">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <img src={logoImg} alt="Gás Fácil" className="h-9 w-9 flex-shrink-0 rounded-xl object-contain shadow-md" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col"
                >
                  <span className="text-[17px] font-bold tracking-[-0.03em] text-sidebar-foreground">
                    Gás Fácil
                  </span>
                  <span className="text-[9px] font-semibold text-primary/60 uppercase tracking-[0.2em]">
                    ERP Pro
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 flex-shrink-0 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </motion.div>
        </div>

        {/* Store Selector */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-sidebar-border/50 p-3"
            >
              <Select
                value={unidadeAtual?.id || ""}
                onValueChange={(val) => {
                  const u = unidades.find((u) => u.id === val);
                  if (u) setUnidadeAtual(u);
                }}
              >
                <SelectTrigger className="bg-sidebar-accent/50 border-sidebar-border/50 text-sidebar-foreground text-xs h-9 rounded-lg">
                  <Store className="mr-2 h-3.5 w-3.5 text-primary" />
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                  {unidades.length === 0 && (
                    <SelectItem value="__none" disabled>Nenhuma unidade</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed Store Icon */}
        {collapsed && (
          <div className="border-b border-sidebar-border/50 p-3 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent/50 cursor-pointer hover:bg-sidebar-accent transition-colors">
                  <Store className="h-4 w-4 text-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{unidadeAtual?.nome || "Selecionar loja"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <div className="space-y-0.5">
            {menuItems.map((item, idx) => {
              const hasSubmenu = !!item.submenu;
              const isOpen = isSubmenuOpen(item.label);
              const isItemActive = isActive(item.path);
              const isChildActive = isSubmenuActive(item.submenu);

              // Collapsed mode
              if (collapsed) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      {item.path ? (
                        <Link
                          to={item.path}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
                            isItemActive
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                          )}
                        >
                          <item.icon className="h-[18px] w-[18px]" />
                        </Link>
                      ) : (
                        <button
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
                            isChildActive
                              ? "bg-primary/10 text-primary"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                          )}
                        >
                          <item.icon className="h-[18px] w-[18px]" />
                        </button>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col gap-1">
                      <p className="font-semibold text-xs">{item.label}</p>
                      {hasSubmenu && (
                        <div className="flex flex-col gap-0.5 mt-1 border-t border-border pt-1">
                          {item.submenu?.map((subItem) => {
                            const SubIcon = subItem.icon;
                            return (
                              <Link
                                key={subItem.path}
                                to={subItem.path}
                                className={cn(
                                  "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors",
                                  isActive(subItem.path) && "bg-accent font-medium text-primary"
                                )}
                              >
                                <SubIcon className="h-3 w-3 flex-shrink-0" />
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              // Expanded mode
              return (
                <motion.div
                  key={item.label}
                  initial={false}
                  layout
                >
                  {item.path ? (
                    <Link
                      to={item.path}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200 relative",
                        isItemActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      )}
                    >
                      <item.icon className={cn(
                        "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 stroke-[2.25]",
                        !isItemActive && "group-hover:scale-110"
                      )} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => toggleSubmenu(item.label)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200",
                        isChildActive
                          ? "bg-primary/8 text-primary"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      )}
                    >
                      <item.icon className={cn(
                        "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 stroke-[2.25]",
                        !isChildActive && "group-hover:scale-110"
                      )} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {hasSubmenu && (
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </motion.div>
                      )}
                    </button>
                  )}

                  {/* Submenu */}
                  <AnimatePresence initial={false}>
                    {hasSubmenu && isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-sidebar-border/40 pl-3 py-1 max-h-[400px] overflow-y-auto scrollbar-thin">
                          {item.submenu?.map((subItem, subIdx) => {
                            const SubIcon = subItem.icon;
                            const subActive = isActive(subItem.path);
                            return (
                              <motion.div
                                key={subItem.path}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: subIdx * 0.02, duration: 0.15 }}
                              >
                                <Link
                                  to={subItem.path}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tracking-[-0.005em] transition-all duration-200",
                                    subActive
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                                  )}
                                >
                                  <SubIcon className={cn(
                                    "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                    !subActive && "group-hover:scale-110 group-hover:text-primary"
                                  )} />
                                  <span className="truncate">{subItem.label}</span>
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
            })}
          </div>
        </nav>

        {/* User + Logout */}
        <div className="flex-shrink-0 border-t border-sidebar-border/50 p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 cursor-pointer">
                    <span className="text-xs font-bold text-primary">{userInitial}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs text-muted-foreground">Logado como</p>
                  <p className="font-medium">{userName}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSignOut}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/40 transition-colors hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-sidebar-accent/40 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{userInitial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold tracking-[-0.02em] text-sidebar-foreground truncate">{userName}</p>
                  <p className="text-[10px] font-medium text-sidebar-foreground/45 truncate uppercase tracking-wider">Administrador</p>
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
            </motion.div>
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
