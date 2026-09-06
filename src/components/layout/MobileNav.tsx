import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  Menu,
  ChevronDown,
  LayoutDashboard,
  Monitor,
  PlusCircle,
  ClipboardList,
  UserPlus,
  PackageOpen,
  Wallet,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MENU_AREAS, menuItems } from "./menuItems";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { UnidadeSelector } from "./UnidadeSelector";
import { usePlanoAccess } from "@/hooks/usePlanoAccess";

const menuIconColors: Record<string, string> = {
  Dashboard: "text-sidebar-foreground",
  "Assistente IA": "text-sidebar-foreground",
  Atendimento: "text-sidebar-foreground",
  Vendas: "text-sidebar-foreground",
  Caixa: "text-sidebar-foreground",
  "Gestão Operacional": "text-sidebar-foreground",
  "Gestão de Clientes": "text-sidebar-foreground",
  "Gestão de Estoque": "text-sidebar-foreground",
  "Gestão Financeira": "text-sidebar-foreground",
  "Gestão de Frota": "text-sidebar-foreground",
  "Gestão de RH": "text-sidebar-foreground",
  "Gestão Fiscal": "text-sidebar-foreground",
  Marketing: "text-sidebar-foreground",
  Configurações: "text-sidebar-foreground/80",
};

const subMenuIconColors: Record<string, string> = new Proxy(
  {},
  {
    get: () => "text-sidebar-foreground/85",
  },
) as Record<string, string>;

const favoriteItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Monitor, label: "PDV", path: "/vendas/pdv" },
  { icon: PlusCircle, label: "Nova Venda", path: "/vendas/nova" },
  { icon: ClipboardList, label: "Pedidos", path: "/vendas/pedidos" },
  { icon: UserPlus, label: "Clientes", path: "/clientes/cadastro" },
  { icon: PackageOpen, label: "Estoque", path: "/estoque" },
  { icon: Wallet, label: "Financeiro", path: "/financeiro/fluxo-caixa" },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { canAccessPath } = usePlanoAccess();
  const { themeClass, brandTheme } = useDashboardTheme();
  const [open, setOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const visibleMenuItems = useMemo(() => {
    const filtered = menuItems
      .map((item) => {
        if (item.submenu) {
          const submenu = item.submenu.filter(
            (subItem) => !subItem.path || canAccessPath(subItem.path),
          );
          return submenu.length > 0 ? { ...item, submenu } : null;
        }

        return canAccessPath(item.path) ? item : null;
      })
      .filter(Boolean) as typeof menuItems;

    const areaOrder = MENU_AREAS.map((area) => area.id);
    return filtered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aIndex = areaOrder.indexOf(
          (a.item.area ?? "configurar") as never,
        );
        const bIndex = areaOrder.indexOf(
          (b.item.area ?? "configurar") as never,
        );
        return aIndex === bIndex ? a.index - b.index : aIndex - bIndex;
      })
      .map(({ item }) => item);
  }, [canAccessPath]);

  const accessibleFavorites = useMemo(
    () => favoriteItems.filter((item) => canAccessPath(item.path)),
    [canAccessPath],
  );

  const displayedMenuItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return visibleMenuItems;

    return visibleMenuItems
      .map((item) => {
        const itemMatches = item.label
          .toLocaleLowerCase("pt-BR")
          .includes(query);
        if (!item.submenu) return itemMatches ? item : null;
        const submenu = item.submenu.filter((sub) =>
          sub.label.toLocaleLowerCase("pt-BR").includes(query),
        );
        return itemMatches || submenu.length > 0
          ? { ...item, submenu: itemMatches ? item.submenu : submenu }
          : null;
      })
      .filter(Boolean) as typeof visibleMenuItems;
  }, [search, visibleMenuItems]);

  const areaHeadings = useMemo(() => {
    const headings: Record<string, string> = {};
    let previousArea: string | undefined;

    displayedMenuItems.forEach((item) => {
      const area = item.area ?? "configurar";
      if (area !== previousArea) {
        headings[item.label] =
          MENU_AREAS.find((entry) => entry.id === area)?.label ?? "";
        previousArea = area;
      }
    });

    return headings;
  }, [displayedMenuItems]);

  // Auto-open active submenu
  useEffect(() => {
    if (open) {
      visibleMenuItems.forEach((item) => {
        if (item.submenu?.some((sub) => location.pathname === sub.path)) {
          setOpenMenus((prev) =>
            prev.includes(item.label) ? prev : [...prev, item.label],
          );
        }
      });
    }
  }, [open, location.pathname, visibleMenuItems]);

  // Allow other components (e.g., MobileBottomBar) to open the drawer
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("mobile-nav:open", handler);
    return () => window.removeEventListener("mobile-nav:open", handler);
  }, []);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => (prev.includes(label) ? [] : [label]));
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
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden h-9 w-9 rounded-xl"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className={cn(
          themeClass,
          "app-sidebar-premium app-mobile-sidebar-modern w-[min(88vw,330px)] overflow-hidden rounded-r-2xl border-r border-sidebar-border/15 p-0 text-sidebar-foreground shadow-2xl",
        )}
      >
        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="flex h-16 items-center border-b border-sidebar-border/15 px-4 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="shrink-0"
              >
                <img
                  src={brandTheme.logoMark}
                  alt="Gás Fácil"
                  className="h-10 w-10 shrink-0 object-contain"
                />
              </motion.div>
              <div className="flex min-w-0 flex-col justify-center leading-none">
                <span className="truncate text-[15px] font-extrabold tracking-[-0.03em] text-sidebar-foreground">
                  Gas Facil
                </span>
                <span className="mt-1 inline-flex w-fit rounded-full bg-sidebar-accent/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-sidebar-foreground/80 ring-1 ring-sidebar-border/20">
                  ERP PRO
                </span>
              </div>
            </div>
          </div>

          <div className="border-b border-sidebar-border/15 px-3 py-3">
            <UnidadeSelector variant="sidebar" />
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/45" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no menu"
                aria-label="Buscar no menu"
                className="h-10 border-sidebar-border/20 bg-sidebar-accent/15 pl-9 text-base text-sidebar-foreground placeholder:text-sidebar-foreground/45 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mb-4">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                Favoritos
              </p>
              <div className="grid grid-cols-2 gap-1">
                {accessibleFavorites.map((fav) => {
                  const FavIcon = fav.icon;
                  const favActive = isActive(fav.path);
                  return (
                    <Link
                      key={fav.path}
                      to={fav.path}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors",
                        favActive
                          ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      <FavIcon className="h-[15px] w-[15px] shrink-0" />
                      <span className="truncate">{fav.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              {displayedMenuItems.map((item, idx) => {
                const Icon = item.icon;
                const hasSubmenu = !!item.submenu;
                const isSubmenuOpen = openMenus.includes(item.label);
                const hasActiveChild = item.submenu?.some((sub) =>
                  isActive(sub.path),
                );
                const areaHeading = areaHeadings[item.label];

                if (hasSubmenu) {
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                    >
                      {areaHeading && (
                        <p className="mb-1 mt-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                          {areaHeading}
                        </p>
                      )}
                      <button
                        onClick={() => toggleMenu(item.label)}
                        className={cn(
                          "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                          hasActiveChild
                            ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                              !hasActiveChild && "group-hover:scale-110",
                              !hasActiveChild &&
                                (menuIconColors[item.label] || ""),
                            )}
                          />
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
                            <div className="ml-6 mt-2 max-h-[360px] space-y-1.5 overflow-y-auto border-l border-sidebar-border/20 py-1.5 pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {item.submenu?.map((sub, subIdx) => {
                                const SubIcon = sub.icon;
                                const subActive = isActive(sub.path);
                                return (
                                  <motion.div
                                    key={sub.path}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                      delay: subIdx * 0.02,
                                      duration: 0.15,
                                    }}
                                  >
                                    {sub.externalUrl ? (
                                      <a
                                        href={sub.externalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setOpen(false)}
                                        className="group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                                      >
                                        <SubIcon
                                          className={cn(
                                            "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                            "group-hover:scale-110",
                                            subMenuIconColors[sub.label] || "",
                                          )}
                                        />
                                        <span className="min-w-0 truncate">
                                          {sub.label}
                                        </span>
                                      </a>
                                    ) : (
                                      <Link
                                        to={sub.path!}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                          "group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150",
                                          subActive
                                            ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                                        )}
                                      >
                                        <SubIcon
                                          className={cn(
                                            "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                            !subActive &&
                                              "group-hover:scale-110",
                                            !subActive &&
                                              (subMenuIconColors[sub.label] ||
                                                ""),
                                          )}
                                        />
                                        <span className="min-w-0 truncate">
                                          {sub.label}
                                        </span>
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
                    {areaHeading && (
                      <p className="mb-1 mt-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                        {areaHeading}
                      </p>
                    )}
                    <Link
                      to={item.path!}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                        isActive(item.path!)
                          ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                          !isActive(item.path!) && "group-hover:scale-110",
                          !isActive(item.path!) &&
                            (menuIconColors[item.label] || ""),
                        )}
                      />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
              {displayedMenuItems.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-sidebar-foreground/60">
                  Nenhuma tela encontrada para “{search}”.
                </div>
              )}
            </div>
          </nav>

          {/* User Footer */}
          <div className="flex-shrink-0 border-t border-sidebar-border/15 bg-sidebar-accent/5 p-3">
            <div className="flex items-center gap-3 rounded-3xl border border-sidebar-border/15 bg-sidebar-accent/10 p-3 shadow-none backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/90 flex-shrink-0 shadow-sm shadow-foreground/10">
                <span className="text-xs font-bold text-sidebar-accent-foreground">
                  {userInitial}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-sidebar-foreground truncate">
                  {userName}
                </p>
                <p className="text-[10px] font-bold text-sidebar-foreground uppercase tracking-wider">
                  Administrador
                </p>
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
