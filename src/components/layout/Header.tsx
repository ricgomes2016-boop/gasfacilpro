import { useEffect, useState, Fragment } from "react";
import { User, LogOut, Settings, UserCircle, RefreshCw, Menu, Sparkles, ChevronRight, Home } from "lucide-react";
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
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MobileNav } from "./MobileNav";
import { UnidadeSelector } from "./UnidadeSelector";
import { forceAppUpdate } from "@/lib/force-app-update";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";
import { CalculatorPopover } from "@/components/shared/CalculatorPopover";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, profile, roles, signOut } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { collapsed, toggle } = useSidebarContext();
  const { brandTheme } = useDashboardTheme();
  const [activePreset, setActivePreset] = useState(() =>
    typeof document === "undefined" ? "" : document.documentElement.getAttribute("data-theme-preset") || ""
  );
  const navigate = useNavigate();
  const location = useLocation();
  const isCleanTheme = activePreset === "operacional-clean";

  const SLUG_LABELS: Record<string, string> = {
    dashboard: "Início",
    financeiro: "Financeiro",
    "contas-a-receber": "Contas a receber",
    "contas-a-pagar": "Contas a pagar",
    "fluxo-de-caixa": "Fluxo de caixa",
    vendas: "Vendas",
    pedidos: "Pedidos",
    pdv: "PDV",
    "nova-venda": "Nova venda",
    devolucoes: "Devoluções",
    clientes: "Clientes",
    estoque: "Estoque",
    cadastros: "Cadastros",
    fiscal: "Fiscal",
    frota: "Frota",
    rh: "RH",
    marketing: "Marketing",
    operacional: "Operacional",
    atendimento: "Atendimento",
    caixa: "Caixa",
    config: "Configurações",
    integracoes: "Integrações",
    admin: "Admin",
    "assistente-ia": "Assistente IA",
  };
  const humanize = (slug: string) =>
    SLUG_LABELS[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: humanize(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  useEffect(() => {
    const syncPreset = () => setActivePreset(document.documentElement.getAttribute("data-theme-preset") || "");
    syncPreset();
    window.addEventListener("theme-change", syncPreset);
    window.addEventListener("storage", syncPreset);

    const observer = new MutationObserver(syncPreset);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-preset"] });

    return () => {
      window.removeEventListener("theme-change", syncPreset);
      window.removeEventListener("storage", syncPreset);
      observer.disconnect();
    };
  }, []);

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
      <header
        className={cn(
          "app-header-premium fixed left-0 right-0 top-0 z-30 flex w-auto max-w-full overflow-visible border-b shadow-sm transition-[left] duration-300",
          isCleanTheme
            ? "clean-header h-14 items-center justify-between px-3 sm:px-5"
            : "flex-col items-stretch justify-center gap-1.5 px-2.5 py-2 backdrop-blur-xl sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:min-h-[4.75rem] md:px-4 xl:px-6",
          !isCleanTheme && (collapsed ? "xl:left-16" : "xl:left-[260px]"),
        )}
      >
        <div className={cn("flex min-w-0 flex-1 items-center", isCleanTheme ? "gap-3" : "gap-2.5")}>
          {isCleanTheme ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="clean-header-menu inline-flex h-10 w-10 rounded-md"
                aria-label={collapsed ? "Abrir menu" : "Fechar menu"}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="clean-header-brand flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left"
                aria-label="Ir para o dashboard"
              >
                <img src={brandTheme.logoMark} alt="Gas Facil" className="h-8 w-8 shrink-0 object-contain" />
                <span className="hidden truncate text-lg font-semibold tracking-tight sm:block">GásFácil</span>
                {(unidadeAtual?.nome || empresa?.nome) && (
                  <>
                    <span className="hidden text-border sm:inline">·</span>
                    <span className="min-w-0 truncate text-sm font-semibold text-primary sm:text-base">
                      {unidadeAtual?.nome || empresa?.nome}
                    </span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className={cn(
          "header-actions flex min-w-0 shrink-0 items-center",
          isCleanTheme
            ? "h-11 justify-end gap-1"
            : "h-11 w-full justify-between gap-0.5 px-0 py-1 sm:h-12 sm:w-auto sm:justify-end sm:gap-1 md:h-14 xl:gap-2"
        )}>
          {!isCleanTheme && <UnidadeSelector />}

          <div className={cn("shrink-0", isCleanTheme ? "block" : "hidden xl:block")}>
            <CommandPalette />
          </div>

          {isCleanTheme && (
            <Button variant="ghost" size="icon" className="clean-header-ai h-9 w-9 rounded-md" title="Assistente IA" onClick={() => {
              if (typeof window !== "undefined" && window.location.pathname.startsWith("/vendas/nova-venda")) {
                window.dispatchEvent(new CustomEvent("nova-venda:open-ai"));
              } else {
                navigate("/assistente-ia");
              }
            }}>
              <Sparkles className="h-4 w-4" />
            </Button>
          )}

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
      <div aria-hidden="true" className={isCleanTheme ? "h-14" : "h-[7rem] sm:h-16 md:h-[4.75rem]"} />
      {isCleanTheme && (
        <div className="clean-page-subbar flex h-12 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
          <h1 className="min-w-0 truncate text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h1>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground sm:flex">
            <Link to="/dashboard" className="flex items-center gap-1 hover:text-primary">
              <Home className="h-3.5 w-3.5" />
              <span>Início</span>
            </Link>
            {crumbs.map((c) => (
              <Fragment key={c.href}>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                {c.isLast ? (
                  <span className="truncate font-medium text-foreground" aria-current="page">{c.label}</span>
                ) : (
                  <Link to={c.href} className="truncate hover:text-primary">{c.label}</Link>
                )}
              </Fragment>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
