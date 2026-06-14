import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  PlusCircle,
  History,
  Users,
  Trophy,
  User,
  Menu,
  Megaphone,
  Target,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SystemFooter } from "@/components/layout/SystemFooter";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo.png";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";

interface Props {
  children: ReactNode;
  title?: string;
}

const tabs = [
  { path: "/vendedor", icon: Home, label: "Início" },
  { path: "/vendedor/nova-venda", icon: PlusCircle, label: "Vender" },
  { path: "/vendedor/historico", icon: History, label: "Histórico" },
  { path: "/vendedor/bolao", icon: Trophy, label: "Bolão" },
];

const menuItems = [
  { path: "/vendedor", icon: Home, label: "Início" },
  { path: "/vendedor/nova-venda", icon: PlusCircle, label: "Nova Venda" },
  { path: "/vendedor/historico", icon: History, label: "Histórico" },
  { path: "/vendedor/clientes", icon: Users, label: "Clientes" },
  { path: "/vendedor/metas", icon: Target, label: "Metas & Comissão" },
  { path: "/vendedor/avisos", icon: Megaphone, label: "Avisos" },
  { path: "/vendedor/bolao", icon: Trophy, label: "Bolão Copa 2026" },
  { path: "/vendedor/perfil", icon: User, label: "Perfil" },
];

export function VendedorLayout({ children, title }: Props) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 gradient-primary text-primary-foreground shadow-lg pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoImg} alt="Logo" className="h-8 w-8 object-contain" />
            <div className="min-w-0">
              <span className="block font-bold text-lg truncate">{title || "Vendedor"}</span>
              <BuildVersionBadge tone="on-primary" className="mt-1 w-fit" />
            </div>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 border-none bg-sidebar text-sidebar-foreground">
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
              <img src={logoImg} alt="Logo" className="h-12 w-12 object-contain" />
              <div>
                <h2 className="font-bold text-lg">App Vendedor</h2>
                <p className="text-sm text-sidebar-foreground/70">Portal de Vendas</p>
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
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-sidebar-border">
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                  navigate("/auth");
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Sair</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center py-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px] text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-medium">Menu</span>
          </button>
        </div>
      </nav>
      <SystemFooter portalKey="entregador" />
    </div>
  );
}
