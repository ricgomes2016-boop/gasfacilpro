import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Truck, LayoutDashboard, CarFront, Users, Route, ArrowLeftRight,
  Receipt, Package, Brain, FileBarChart, LogOut, Menu, X, ShoppingCart,
} from "lucide-react";
import { SystemFooter } from "@/components/layout/SystemFooter";
import { SidebarProvider } from "@/contexts/SidebarContext";

const navItems = [
  { to: "/transportadora", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transportadora/veiculos", icon: CarFront, label: "Veículos" },
  { to: "/transportadora/funcionarios", icon: Users, label: "Funcionários" },
  { to: "/transportadora/simulacao", icon: Route, label: "Simulação" },
  { to: "/transportadora/rota-atacado", icon: Route, label: "Rota Atacado" },
  { to: "/transportadora/compras", icon: ShoppingCart, label: "Compras" },
  { to: "/transportadora/abastecimento", icon: ArrowLeftRight, label: "Transferência" },
  { to: "/transportadora/lancamento", icon: Receipt, label: "Despesas" },
  { to: "/transportadora/entregas", icon: Package, label: "Entregas & Vendas" },
  { to: "/transportadora/ia", icon: Brain, label: "IA Analista" },
  { to: "/transportadora/relatorios", icon: FileBarChart, label: "Relatórios" },
];

function TransportadoraLayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border/40">
        <Link to="/transportadora" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">GásFácil Pro</h1>
            <p className="text-xs text-muted-foreground">Transportadora</p>
          </div>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-teal-600 dark:text-teal-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-border/40">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border/40 bg-card/50 flex-col">
        <NavContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card shadow-xl">
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 p-3 border-b border-border/40 bg-card/50">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-teal-600" />
            <span className="font-semibold text-sm">Transportadora</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pb-14">
          {children}
        </main>
      </div>
      <SystemFooter portalKey="transportadora" />
    </div>
  );
}

export function TransportadoraLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <TransportadoraLayoutInner>{children}</TransportadoraLayoutInner>
    </SidebarProvider>
  );
}
