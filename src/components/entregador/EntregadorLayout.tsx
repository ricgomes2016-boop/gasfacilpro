import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  Package,
  Receipt,
  PlusCircle,
  User,
  Menu,
  Flame,
  History,
  Fuel,
  BoxesIcon,
  ArrowRightLeft,
  Trophy,
  TrendingUp,
  ShoppingBag,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationToggle } from "./NotificationToggle";
import { useGeoTracking } from "@/hooks/useGeoTracking";
import { GpsPermissionBanner } from "./GpsPermissionBanner";
import { PendingDeliveriesBanner } from "./PendingDeliveriesBanner";
import { ChatBase } from "./ChatBase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/logo.png";

interface EntregadorLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { path: "/entregador", icon: Home, label: "Início" },
  { path: "/entregador/jornada", icon: Flame, label: "Jornada" },
  { path: "/entregador/entregas", icon: Package, label: "Entregas" },
  { path: "/entregador/produtividade", icon: TrendingUp, label: "Produtividade" },
  { path: "/entregador/vendas", icon: ShoppingBag, label: "Qtd Vendida" },
  { path: "/entregador/financeiro", icon: Receipt, label: "Financeiro" },
  { path: "/entregador/treinamento", icon: GraduationCap, label: "Treinamento" },
  { path: "/entregador/nova-venda", icon: PlusCircle, label: "Nova Venda" },
  { path: "/entregador/estoque", icon: BoxesIcon, label: "Estoque" },
  { path: "/entregador/transferencia", icon: ArrowRightLeft, label: "Transferir" },
  { path: "/entregador/despesas", icon: Receipt, label: "Despesas" },
  { path: "/entregador/combustivel", icon: Fuel, label: "Combustível" },
  { path: "/entregador/conquistas", icon: Trophy, label: "Conquistas" },
  { path: "/entregador/historico", icon: History, label: "Histórico" },
  { path: "/entregador/perfil", icon: User, label: "Perfil" },
];

export function EntregadorLayout({ children, title }: EntregadorLayoutProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Track driver GPS and update DB every 30s
  useGeoTracking();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 gradient-primary text-primary-foreground shadow-lg pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetContent side="left" className="w-72 p-0 border-none">
                <div className="gradient-dark h-full flex flex-col">
                  <div className="flex items-center gap-3 p-6 border-b border-white/10 flex-shrink-0">
                    <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center shadow-glow">
                      <img src={logoImg} alt="Nacional Gás" className="h-12 w-12 object-contain" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-lg">App Entregador</h2>
                      <p className="text-sm text-white/70">Revenda de Gás</p>
                    </div>
                  </div>
                  <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                            isActive
                              ? "gradient-primary text-white shadow-glow"
                              : "text-white/80 hover:bg-white/10"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  {/* Botão Sair */}
                  <div className="p-4 border-t border-white/10">
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                        navigate("/auth");
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-white/80 hover:bg-red-500/20 hover:text-red-300 w-full"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">Sair</span>
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
           <div className="flex items-center gap-2">
              <img src={logoImg} alt="Nacional Gás" className="h-7 w-7 object-contain" />
              <span className="font-bold text-lg">{title || "Entregador"}</span>
            </div>
          </div>
          <NotificationToggle className="text-primary-foreground hover:bg-white/20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <GpsPermissionBanner />
        <PendingDeliveriesBanner />
        {children}
      </main>

      {/* Chat FAB */}
      <ChatBase />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center py-2">
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px] text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-medium">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
