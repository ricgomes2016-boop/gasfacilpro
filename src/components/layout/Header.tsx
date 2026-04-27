import { User, LogOut, Settings, UserCircle, Moon, Sun, RefreshCw } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import { BaseChatPanel } from "@/components/chat/BaseChatPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MobileNav } from "./MobileNav";
import { UnidadeSelector } from "./UnidadeSelector";
import { useTheme } from "@/hooks/useTheme";
import { forceAppUpdate } from "@/lib/force-app-update";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";
import { GasmaisThemeQuickToggle } from "@/components/layout/GasmaisThemeQuickToggle";
import { CalculatorPopover } from "@/components/shared/CalculatorPopover";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, profile, roles, signOut } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { collapsed } = useSidebarContext();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleUpdateApp = async () => {
    toast.info("Atualizando sistema para a versão mais recente...");
    try {
      await forceAppUpdate();
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "gestor":
        return "default";
      case "financeiro":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <>
    <header className={cn(
      "fixed left-0 right-0 top-0 z-30 flex w-auto max-w-full flex-col items-stretch justify-center gap-1.5 overflow-hidden border-b border-sidebar-border/10 bg-secondary px-3 py-2 text-secondary-foreground shadow-sm shadow-foreground/10 transition-[left] duration-300 sm:min-h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:min-h-16 md:px-4 xl:px-6",
      collapsed ? "xl:left-16" : "xl:left-[260px]",
    )}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Mobile menu */}
        <MobileNav />
        
        <div className="flex h-11 min-w-0 flex-1 flex-col justify-center rounded-xl border border-sidebar-border/10 bg-sidebar-foreground/10 px-3 py-1.5 shadow-none sm:px-4 md:h-12">
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <h1 className="min-w-0 truncate text-base font-semibold leading-none text-secondary-foreground md:text-lg xl:text-xl">{title}</h1>
            <BuildVersionBadge className="hidden xl:inline-flex shrink-0" />
          </div>
          <p className="hidden max-w-full truncate text-[11px] font-normal leading-tight text-secondary-foreground/70 sm:block md:text-xs">
            {empresa && <span className="font-medium">{empresa.nome}</span>}
            {subtitle && <span>{empresa ? " — " : ""}{subtitle}</span>}
            {unidadeAtual && <span className="ml-2 font-medium text-primary">• {unidadeAtual.nome}</span>}
          </p>
        </div>
      </div>

      <div className="flex h-10 min-w-0 shrink-0 items-center justify-between gap-0.5 rounded-xl border border-sidebar-border/10 bg-sidebar-foreground/10 px-1 py-1 shadow-none sm:h-11 sm:justify-end sm:gap-1 md:h-12 xl:gap-2">
        {/* Unidade Selector */}
        <UnidadeSelector />

        {/* Command Palette (⌘K) — desktop only */}
        <div className="hidden xl:block shrink-0">
          <CommandPalette />
        </div>

        {/* Chat with Entregadores */}
        <div className="hidden min-[360px]:block">
          <BaseChatPanel />
        </div>

        {/* Notifications */}
        <NotificationCenter />

        {/* GásMais Theme Quick Toggle */}
        <GasmaisThemeQuickToggle />

        {/* Calculadora */}
        <div className="hidden min-[360px]:block">
          <CalculatorPopover />
        </div>

        {/* Atualizar Preview */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
          onClick={handleUpdateApp}
          title="Atualizar Preview"
          aria-label="Atualizar Preview"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hidden xl:inline-flex shrink-0 text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-secondary-foreground hover:bg-primary hover:text-primary-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <p className="text-sm font-medium leading-none">
                  {profile?.full_name || user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {roles.map((role) => (
                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
                <BuildVersionBadge className="w-fit" prefix="Versão" />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/meu-perfil")}>
              <UserCircle className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/config/auditoria")}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUpdateApp}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar Sistema
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <div aria-hidden="true" className="h-[6.5rem] sm:h-14 md:h-16" />
    </>
  );
}
