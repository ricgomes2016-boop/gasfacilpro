import { User, LogOut, Settings, UserCircle, RefreshCw, Menu, Sparkles } from "lucide-react";
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
import { forceAppUpdate } from "@/lib/force-app-update";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";
import { CalculatorPopover } from "@/components/shared/CalculatorPopover";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, profile, roles, signOut } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { collapsed, toggle } = useSidebarContext();
  const { theme, brandTheme } = useDashboardTheme();
  const isClean = theme === "operacional-clean";
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

  // Clean theme: header sempre full-width; sidebar é overlay controlado pelo hambúrguer
  const cleanFullWidth = isClean && collapsed;

  if (isClean) {
    return (
      <>
        <header
          className={cn(
            "app-header-premium app-header-clean fixed left-0 right-0 top-0 z-30 flex h-14 w-auto max-w-full items-center justify-between border-b px-3 transition-[left] duration-300 md:px-4",
            cleanFullWidth ? "xl:left-0" : "xl:left-[260px]",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-9 w-9 shrink-0 rounded-md"
              aria-label="Alternar menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex min-w-0 items-center gap-2"
            >
              <img src={brandTheme.logoMark} alt="Gas Facil" className="h-7 w-7 shrink-0 object-contain" />
              <span className="truncate text-base font-extrabold tracking-tight">GasFácil</span>
            </button>
          </div>

          <div className="header-actions flex h-full shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/assistente-ia")}
              className="clean-ia-button h-9 w-9 shrink-0 rounded-md"
              aria-label="Assistente IA"
            >
              <Sparkles className="h-4 w-4" />
            </Button>

            <NotificationCenter />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                    <User className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-2">
                    <p className="text-sm font-medium leading-none">
                      {profile?.full_name || user?.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
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

        <div aria-hidden="true" className="h-14" />
      </>
    );
  }

  return (
    <>
      <header
        className={cn(
          "app-header-premium fixed left-0 right-0 top-0 z-30 flex w-auto max-w-full flex-col items-stretch gap-1.5 overflow-visible border-b px-2.5 py-2 shadow-sm backdrop-blur-xl transition-[left] duration-300 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:min-h-[4.75rem] md:px-4 xl:px-6",
          collapsed ? "xl:left-16" : "xl:left-[260px]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <MobileNav />
          <div className="flex h-12 min-w-0 flex-1 flex-col justify-center gap-1 px-1 py-1.5 sm:px-2 md:h-14">
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <h1 className="min-w-0 truncate text-base font-bold leading-none text-primary md:text-lg xl:text-xl">
                {title}
              </h1>
              <BuildVersionBadge className="hidden shrink-0 xl:inline-flex" />
            </div>
            <div className="hidden min-w-0 max-w-full items-center gap-1.5 text-[11px] font-medium leading-tight text-foreground/65 sm:flex md:text-xs">
              {empresa && (
                <span className="max-w-[12rem] truncate font-semibold text-foreground/80 xl:max-w-[16rem]">
                  {empresa.nome}
                </span>
              )}
              {empresa && subtitle && <span className="text-border">|</span>}
              {subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
              {unidadeAtual && (
                <>
                  <span className="text-border">|</span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/15 md:text-[11px]">
                    {unidadeAtual.nome}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="header-actions flex h-11 w-full min-w-0 shrink-0 items-center justify-between gap-0.5 px-0 py-1 sm:h-12 sm:w-auto sm:justify-end sm:gap-1 md:h-14 xl:gap-2">
          <UnidadeSelector />
          <div className="hidden shrink-0 xl:block">
            <CommandPalette />
          </div>
          <div className="hidden min-[360px]:block">
            <BaseChatPanel />
          </div>
          <NotificationCenter />
          <div className="hidden min-[360px]:block">
            <CalculatorPopover />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-primary hover:bg-primary/10 hover:text-primary">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/20">
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

      <div aria-hidden="true" className="h-[7rem] sm:h-16 md:h-[4.75rem]" />
    </>
  );
}
