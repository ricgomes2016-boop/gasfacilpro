import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Truck, LayoutDashboard, CarFront, Users, Route, ArrowLeftRight,
  Receipt, Package, Brain, FileBarChart, LogOut, Menu, ShoppingCart,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { SystemFooter } from "@/components/layout/SystemFooter";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";

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
  const { collapsed, toggle } = useSidebarContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const NavContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("border-b border-border/40", isCollapsed ? "p-3" : "p-4")}>
        <Link to="/transportadora" className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shrink-0">
            <Truck className="h-6 w-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground leading-tight truncate">GásFácil Pro</h1>
              <p className="text-xs text-muted-foreground truncate">Transportadora</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav links */}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", isCollapsed ? "p-2" : "p-3")}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all",
                isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-teal-600 dark:text-teal-400")} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className={cn("border-t border-border/40", isCollapsed ? "p-2" : "p-3")}>
        <Button
          variant="ghost"
          className={cn("w-full text-muted-foreground", isCollapsed ? "justify-center px-2" : "justify-start gap-3")}
          onClick={handleSignOut}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && "Sair"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex border-r border-border/40 bg-card/50 flex-col transition-[width] duration-200 relative",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <NavContent isCollapsed={collapsed} />
        <button
          onClick={toggle}
          className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted shadow-sm flex items-center justify-center"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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
