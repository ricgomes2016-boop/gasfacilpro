import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import {
  LogOut, FileText, LayoutDashboard, FileCode, Receipt, Banknote,
  Building2, Calendar, Megaphone, ClipboardList, Menu, X, BookOpen,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { SeletorEmpresaUnidade } from "@/components/contador/SeletorEmpresaUnidade";
import { FiltroPeriodo } from "@/components/contador/FiltroPeriodo";
import { SystemFooter } from "@/components/layout/SystemFooter";


interface ContadorPortalLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Início", path: "/contador" },
  { icon: Building2, label: "Empresas", path: "/contador/empresas" },
  { icon: FileCode, label: "Entrada XML", path: "/contador/xml" },
  { icon: Receipt, label: "Despesas", path: "/contador/despesas" },
  { icon: Banknote, label: "Financeiro", path: "/contador/financeiro" },
  { icon: BookOpen, label: "Plano de Contas", path: "/contador/plano-contas" },
  { icon: FileText, label: "Documentos", path: "/contador/documentos" },
  { icon: Calendar, label: "Calendário", path: "/contador/calendario" },
  { icon: ClipboardList, label: "Solicitações", path: "/contador/solicitacoes" },
  { icon: Megaphone, label: "Comunicados", path: "/contador/comunicados" },
];

export function ContadorPortalLayout({ children }: ContadorPortalLayoutProps) {
  const { signOut, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="theme-contador min-h-screen text-foreground flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 flex flex-col",
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        "transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <img src={logoImg} alt="Logo" className="h-9 w-9 rounded-lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate text-sidebar-foreground">Portal Contábil</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.full_name || "Contador"}</p>
          </div>
          <Button
            variant="ghost" size="icon"
            className="lg:hidden h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/contador"}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                "transition-colors duration-150"
              )}
              activeClassName="bg-primary/20 text-primary hover:text-primary hover:bg-primary/25"
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <Button
            variant="ghost" onClick={signOut}
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex flex-col gap-2 px-4 py-3 bg-card/70 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="ghost" size="icon"
              className="lg:hidden h-9 w-9 text-foreground/70"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-[220px] max-w-2xl">
              <SeletorEmpresaUnidade />
            </div>
            <div className="ml-auto">
              <FiltroPeriodo />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:pb-14">
          {children}
        </main>
      </div>
      <SystemFooter portalKey="contador" />
    </div>
  );
}
