import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  LayoutDashboard,
  MapPin,
  Users,
  LogOut,
  Menu,
  X,
  Flame,
  ChevronRight,
  Settings,
  Bell,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SystemFooter } from "@/components/layout/SystemFooter";
import { SidebarProvider } from "@/contexts/SidebarContext";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, description: "Visão geral da plataforma" },
  { label: "Empresas", href: "/admin/empresas", icon: Building2, description: "Gerenciar tenants" },
  { label: "Unidades", href: "/admin/unidades", icon: MapPin, description: "Filiais e matrizes" },
  { label: "Administradores", href: "/admin/admins", icon: Users, description: "Gestores das empresas" },
  { label: "Integrações Meta", href: "/admin/meta-integracoes", icon: Share2, description: "Conexões OAuth Facebook/Instagram" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SA";

  return (
    <SidebarProvider>
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-72 flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl">
        {/* Logo area */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight">Gás Fácil</h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-primary border-primary/30">
                PLATFORM ADMIN
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
            Menu Principal
          </p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                  isActive ? "bg-primary/15" : "bg-muted/50 group-hover:bg-muted"
                )}>
                  <item.icon className={cn("h-4 w-4", isActive && "text-primary")} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="block text-[10px] text-muted-foreground font-normal truncate">
                    {item.description}
                  </span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary/60" />}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div className="p-3 border-t border-border/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.full_name || "Super Admin"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da plataforma
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 md:px-8 h-16 border-b border-border/50 bg-card/60 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="md:hidden flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              <span className="font-bold text-sm">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="md:hidden border-b border-border/50 bg-card/95 backdrop-blur-xl p-4 space-y-1 animate-slide-in">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start mt-3 text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 md:pb-14 overflow-auto">{children}</main>
      </div>
      <SystemFooter portalKey="painel" />
    </div>
    </SidebarProvider>
  );
}
