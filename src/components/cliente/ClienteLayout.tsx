import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  ShoppingCart, 
  Gift, 
  Wallet, 
  User, 
  Menu, 
  X, 
  History,
  Flame,
  BookOpen,
  Calculator,
  CreditCard,
  RefreshCw,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LojaSelector } from "@/components/cliente/LojaSelector";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import logoImg from "@/assets/logo.png";
import { SystemFooter } from "@/components/layout/SystemFooter";
import { useCliente } from "@/contexts/ClienteContext";

interface ClienteLayoutProps {
  children: ReactNode;
  cartItemsCount?: number;
}

const menuItems = [
  { icon: Home, label: "Início", path: "/cliente" },
  { icon: ShoppingCart, label: "Carrinho", path: "/cliente/carrinho" },
  { icon: History, label: "Minhas Compras", path: "/cliente/historico" },
  { icon: Gift, label: "Indique e Ganhe", path: "/cliente/indicacao" },
  { icon: Wallet, label: "Minha Carteira", path: "/cliente/carteira" },
  { icon: CreditCard, label: "Meus Vales Gás", path: "/cliente/vale-gas" },
  { icon: RefreshCw, label: "Assinaturas", path: "/cliente/assinaturas" },
  { icon: Calculator, label: "Consumo Médio", path: "/cliente/consumo" },
  { icon: BookOpen, label: "Dicas e Receitas", path: "/cliente/dicas" },
  { icon: User, label: "Meu Perfil", path: "/cliente/perfil" },
];

const bottomNavItems = [
  { icon: Home, label: "Início", path: "/cliente" },
  { icon: ShoppingCart, label: "Carrinho", path: "/cliente/carrinho", showBadge: true },
  { icon: Gift, label: "Indicar", path: "/cliente/indicacao" },
  { icon: Wallet, label: "Carteira", path: "/cliente/carteira" },
  { icon: Menu, label: "Menu", path: "__menu__" as const },
];


export function ClienteLayout({ children, cartItemsCount: cartItemsCountProp }: ClienteLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { cartItemsCount: ctxCount, empresaInfo, lojas, lojaSelecionadaId } = useCliente();
  const cartItemsCount = cartItemsCountProp ?? ctxCount;
  const isCarrinhoPage = location.pathname === "/cliente/carrinho";
  const isCheckoutPage = location.pathname === "/cliente/checkout";
  const isHomeOrCategoria = location.pathname === "/cliente";

  const empresaNome = empresaInfo?.nome || "Gás Fácil";
  const lojaSelecionada = lojas.find(l => l.id === lojaSelecionadaId);
  const tituloPrincipal = lojaSelecionada?.nome || empresaNome;

  const showFloatingCart = cartItemsCount > 0 && !isCarrinhoPage && !isCheckoutPage;
  const hasMultipleLojas = lojas.length > 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header — minimal premium */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-sm border-b border-primary/20">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-primary-foreground/10 flex items-center justify-center shrink-0">
              {empresaInfo?.logo_url ? (
                <img src={empresaInfo.logo_url} alt={tituloPrincipal} className="h-7 w-7 object-contain rounded-lg" />
              ) : (
                <img src={logoImg} alt={tituloPrincipal} className="h-6 w-6 object-contain" />
              )}
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[10px] uppercase tracking-[0.14em] opacity-70 font-medium">Sua loja</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-base tracking-tight truncate">
                  {tituloPrincipal}
                </span>
                {hasMultipleLojas && (
                  <div className="shrink-0 [&>*]:!text-primary-foreground [&_button]:!h-6 [&_button]:!px-1.5 [&_button]:!bg-primary-foreground/10 [&_button]:!border-primary-foreground/20">
                    <LojaSelector />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetContent side="right" className="w-80 p-0">
              <div className="bg-gradient-to-b from-primary via-primary to-primary/85 text-primary-foreground p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {empresaInfo?.logo_url ? (
                      <img src={empresaInfo.logo_url} alt={empresaNome} className="h-7 w-7 object-contain rounded" />
                    ) : (
                      <img src={logoImg} alt={empresaNome} className="h-7 w-7 object-contain" />
                    )}
                    <span className="font-bold text-lg">{empresaNome}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMenuOpen(false)}
                    className="text-primary-foreground hover:bg-white/15"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-primary-foreground/80 text-sm">Bem-vindo ao app do cliente</p>
              </div>

              <nav className="p-4">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between py-3 px-3 rounded-lg transition-colors mb-1",
                      location.pathname === item.path
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

        </div>
      </header>

      {/* Main Content */}
      <main
        className={cn(
          "px-4 py-4 scroll-pb-28",
          showFloatingCart ? "pb-32" : "pb-20"
        )}
      >
        {children}
      </main>

      {/* Floating Cart Button - global, único */}
      {showFloatingCart && (
        <div className="fixed bottom-[76px] left-0 right-0 px-4 z-40 pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300">
          <Button
            className="w-full h-13 py-3 rounded-2xl shadow-xl shadow-primary/40 gap-3 text-base font-semibold pointer-events-auto"
            onClick={() => navigate("/cliente/carrinho")}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="flex-1 text-left">Ver carrinho</span>
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs h-6 px-2">
              {cartItemsCount} {cartItemsCount === 1 ? "item" : "itens"}
            </Badge>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bottom Navigation — premium pill indicator */}
      <nav className="fixed bottom-0 left-0 right-0 backdrop-blur-md bg-background/90 border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center py-1.5">
          {bottomNavItems.map((item) => {
            const isMenu = item.path === "__menu__";
            const isActive = !isMenu && location.pathname === item.path;
            const baseCls = cn(
              "flex flex-col items-center justify-center pt-1.5 pb-1 px-3 rounded-xl transition-all duration-200 relative min-w-[56px]",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground active:scale-95"
            );
            const inner = (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-primary animate-fade-in" />
                )}
                <div className="relative">
                  <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                  {item.showBadge && cartItemsCount > 0 && (
                    <Badge
                      className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] bg-destructive animate-bounce"
                    >
                      {cartItemsCount}
                    </Badge>
                  )}
                </div>
                <span className={cn("text-[10px] mt-0.5 font-medium", isActive && "font-semibold")}>{item.label}</span>
              </>
            );
            if (isMenu) {
              return (
                <button
                  key="menu"
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className={baseCls}
                  aria-label="Abrir menu"
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link key={item.path} to={item.path} className={baseCls}>
                {inner}
              </Link>
            );
          })}

        </div>
      </nav>
      <SystemFooter portalKey="cliente" />
    </div>
  );
}
