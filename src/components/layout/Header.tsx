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
      "fixed left-0 right-0 top-0 z-30 flex min-h-16 w-auto max-w-full items-center justify-between gap-2 overflow-hidden border-b border-border/35 bg-background/88 px-2.5 py-2 shadow-sm shadow-foreground/5 backdrop-blur-xl transition-[left] duration-300 supports-[backdrop-filter]:bg-background/78 md:min-h-[4.75rem] md:px-4 xl:px-6",
      collapsed ? "xl:left-16" : "xl:left-[260px]",
    )}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Mobile menu */}
        <MobileNav />
        
        <div className="flex h-12 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-border/45 bg-card px-4 py-1.5 shadow-sm shadow-foreground/5 md:h-14">
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <h1 className="min-w-0 truncate text-base font-bold leading-none text-foreground md:text-lg xl:text-xl">{title}</h1>
            <BuildVersionBadge className="hidden xl:inline-flex shrink-0" />
          </div>
          <p className="hidden max-w-full truncate text-[11px] font-medium leading-tight text-muted-foreground sm:block md:text-xs">
            {empresa && <span className="font-medium">{empresa.nome}</span>}
            {subtitle && <span>{empresa ? " — " : ""}{subtitle}</span>}
            {unidadeAtual && <span className="ml-2 text-primary font-medium">• {unidadeAtual.nome}</span>}
          </p>
        </div>
      </div>

      <div className="flex h-12 min-w-0 shrink-0 items-center justify-end gap-0.5 rounded-2xl border border-border/45 bg-card px-1 py-1 shadow-sm shadow-foreground/5 sm:gap-1 md:h-14 xl:gap-2">
        {/* Unidade Selector */}
        <UnidadeSelector />

        {/* Command Palette (⌘K) — desktop only */}
        <div className="hidden xl:block shrink-0">
          <CommandPalette />
        </div>

        {/* Chat with Entregadores */}
        <BaseChatPanel />

        {/* Notifications */}
        <NotificationCenter />

        {/* GásMais Theme Quick Toggle */}
        <GasmaisThemeQuickToggle />

        {/* Calculadora */}
        <CalculatorPopover />

        {/* Atualizar Preview */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
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
          className="h-9 w-9 hidden xl:inline-flex shrink-0"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0">
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
    <div aria-hidden="true" className="h-16 md:h-[4.75rem]" />
    </>
  );
}
