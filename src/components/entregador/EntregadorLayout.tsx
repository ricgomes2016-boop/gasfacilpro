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
  HandCoins,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationToggle } from "./NotificationToggle";
import { useGeoTracking, GeoTrackingState } from "@/hooks/useGeoTracking";
import { GpsPermissionBanner } from "./GpsPermissionBanner";
import { TrackingStatusHeader } from "./TrackingStatusHeader";
import { PendingDeliveriesBanner } from "./PendingDeliveriesBanner";
import { SystemFooter } from "@/components/layout/SystemFooter";
import { ChatBase } from "./ChatBase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";
import { useAvisosEntregador } from "@/hooks/useAvisosEntregador";

interface EntregadorLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { path: "/entregador", icon: Home, label: "Início" },
  { path: "/entregador/jornada", icon: Flame, label: "Jornada" },
  { path: "/entregador/entregas", icon: Package, label: "Entregas" },
  { path: "/entregador/nova-venda", icon: PlusCircle, label: "Nova Venda" },
  { path: "/entregador/produtividade", icon: TrendingUp, label: "Produtividade" },
  { path: "/entregador/vendas", icon: ShoppingBag, label: "Qtd Vendida" },
  { path: "/entregador/financeiro", icon: Receipt, label: "Financeiro" },
  { path: "/entregador/contas-prazo", icon: HandCoins, label: "Contas a Prazo" },
  { path: "/entregador/devolucoes", icon: RotateCcw, label: "Devoluções/Trocas" },
  { path: "/entregador/treinamento", icon: GraduationCap, label: "Treinamento" },
  { path: "/entregador/estoque", icon: BoxesIcon, label: "Estoque" },
  { path: "/entregador/transferencia", icon: ArrowRightLeft, label: "Transferir" },
  { path: "/entregador/despesas", icon: Receipt, label: "Despesas" },
  { path: "/entregador/combustivel", icon: Fuel, label: "Combustível" },
  { path: "/entregador/conquistas", icon: Trophy, label: "Conquistas" },
  { path: "/entregador/bolao", icon: Trophy, label: "Bolão Copa 2026" },
  { path: "/entregador/historico", icon: History, label: "Histórico" },
  { path: "/entregador/perfil", icon: User, label: "Perfil" },
];

export function EntregadorLayout({ children, title }: EntregadorLayoutProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { naoLidos } = useAvisosEntregador(false);

  // Track driver GPS and update DB
  const trackingState = useGeoTracking();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 gradient-primary text-primary-foreground shadow-lg pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetContent side="left" className="w-72 p-0 border-none bg-sidebar text-sidebar-foreground">
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-3 p-6 border-b border-sidebar-border flex-shrink-0">
                    <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center shadow-glow bg-background">
                      <img src={logoImg} alt="Nacional Gás" className="h-12 w-12 object-contain" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sidebar-foreground text-lg">App Entregador</h2>
                      <p className="text-sm text-sidebar-foreground/70">Revenda de Gás</p>
                      <BuildVersionBadge prefix="Versão" className="mt-2 w-fit" />
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
                              ? "gradient-primary text-primary-foreground shadow-glow"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <div className="relative">
                            <Icon className="h-5 w-5" />
                            {item.path === "/entregador" && naoLidos > 0 && (
                              <span className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                                {naoLidos > 9 ? "9+" : naoLidos}
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  {/* Botão Sair */}
                  <div className="p-4 border-t border-sidebar-border">
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                        navigate("/auth");
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive w-full"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">Sair</span>
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2 min-w-0">
              <img src={logoImg} alt="Nacional Gás" className="h-7 w-7 object-contain" />
               <div className="min-w-0">
                 <span className="block font-bold text-lg truncate">{title || "Entregador"}</span>
                 <BuildVersionBadge tone="on-primary" className="mt-1 w-fit" />
               </div>
            </div>
          </div>
          <NotificationToggle className="text-primary-foreground hover:bg-white/20" />
        </div>
        <TrackingStatusHeader tracking={trackingState} />
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
                <div className="relative">
                  <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                  {item.path === "/entregador" && naoLidos > 0 && (
                    <span className="absolute -right-2.5 -top-2 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                      {naoLidos > 9 ? "9+" : naoLidos}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px] text-muted-foreground hover:text-foreground"
          >
            <div className="relative">
              <Menu className="h-5 w-5" />
              {naoLidos > 0 && (
                <span className="absolute -right-2.5 -top-2 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                  {naoLidos > 9 ? "9+" : naoLidos}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">Menu</span>
          </button>
        </div>
      </nav>
      <SystemFooter portalKey="entregador" />
    </div>
  );
}
