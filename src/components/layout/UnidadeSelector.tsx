import { Building2, ChevronDown, Pencil } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface UnidadeSelectorProps {
  variant?: "header" | "sidebar";
  collapsed?: boolean;
}

function formatCnpj(cnpj?: string | null) {
  const digits = (cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) return cnpj || "CNPJ não informado";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function UnidadeSelector({ variant = "header", collapsed = false }: UnidadeSelectorProps) {
  const { unidades, unidadeAtual, loading, setUnidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const isSidebar = variant === "sidebar";
  const [visualIdentity, setVisualIdentity] = useState<{ nomeEmpresa: string | null; logoUrl: string | null }>({
    nomeEmpresa: null,
    logoUrl: null,
  });

  useEffect(() => {
    if (!isSidebar || !unidadeAtual?.id) {
      setVisualIdentity({ nomeEmpresa: null, logoUrl: null });
      return;
    }

    let cancelled = false;
    supabase
      .from("configuracoes_visuais")
      .select("nome_empresa, logo_url")
      .eq("unidade_id", unidadeAtual.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setVisualIdentity({
          nomeEmpresa: data?.nome_empresa || null,
          logoUrl: data?.logo_url || null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isSidebar, unidadeAtual?.id]);

  const displayName = visualIdentity.nomeEmpresa || unidadeAtual?.nome || "Selecionar";

  const handleEditLogo = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    navigate("/config/personalizacao");
  };

  const renderSidebarLogo = () => (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleEditLogo}
      className="group/logo relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-white shadow-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      aria-label="Editar logo da empresa"
      title="Editar logo da empresa"
    >
      {visualIdentity.logoUrl ? (
        <img src={visualIdentity.logoUrl} alt={displayName} className="h-full w-full object-cover" />
      ) : (
        <Building2 className="h-5 w-5" />
      )}
      <span className="sidebar-logo-edit-indicator absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/50 bg-white text-slate-900 shadow-sm transition-transform group-hover/logo:scale-105">
        <Pencil className="h-3 w-3" />
      </span>
    </button>
  );

  const renderSidebarText = () => (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-white">{displayName}</span>
        <Badge variant="outline" className="sidebar-unit-badge shrink-0 text-[10px] capitalize">
          {unidadeAtual?.tipo}
        </Badge>
      </div>
      <p className="mt-1 truncate text-[11px] font-medium text-white/75">
        {formatCnpj(unidadeAtual?.cnpj)}
      </p>
    </div>
  );

  if (loading) {
    return <Skeleton className={cn("shrink-0", isSidebar ? "h-14 w-full rounded-md" : "h-9 w-32 sm:w-36 xl:w-44")} />;
  }

  if (unidades.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn(
          "shrink-0 gap-1 text-xs font-semibold",
          isSidebar
            ? "sidebar-unit-selector h-14 w-full justify-start rounded-md px-3"
            : "header-unit-selector h-9 min-w-[128px] max-w-[46vw] px-2 sm:min-w-[144px] sm:max-w-[180px] xl:max-w-[220px]"
        )}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="min-w-0 truncate">Sem loja</span>}
      </Button>
    );
  }

  // If only one unidade, just show it without dropdown
  if (unidades.length === 1) {
    if (isSidebar) {
      return (
        <div className="sidebar-unit-selector flex min-h-20 w-full items-center gap-3 rounded-md border px-3 py-3">
          {renderSidebarLogo()}
          {!collapsed && renderSidebarText()}
        </div>
      );
    }

    return (
      <div className="header-unit-selector flex h-9 min-w-[128px] max-w-[46vw] shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 shadow-sm sm:min-w-[144px] sm:max-w-[180px] xl:max-w-[240px] xl:px-3">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
          {unidadeAtual?.nome}
        </span>
        <Badge variant="outline" className="text-xs capitalize hidden xl:inline-flex border-primary/20 bg-primary/10 text-primary shrink-0">
          {unidadeAtual?.tipo}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isSidebar ? (
          <div
            role="button"
            tabIndex={0}
            className="sidebar-unit-selector flex h-auto min-h-20 w-full cursor-pointer items-center justify-start gap-3 rounded-md border px-3 py-3 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {renderSidebarLogo()}
            {!collapsed && (
              <>
                {renderSidebarText()}
                <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
              </>
            )}
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="header-unit-selector h-9 min-w-[128px] max-w-[46vw] shrink-0 gap-1 px-2 sm:min-w-[144px] sm:max-w-[180px] xl:max-w-[240px] xl:px-3"
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
              {unidadeAtual?.nome || "Selecionar"}
            </span>
            <Badge variant="outline" className="text-xs capitalize hidden xl:inline-flex border-primary/20 bg-primary/10 text-primary shrink-0">
              {unidadeAtual?.tipo}
            </Badge>
            <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isSidebar ? "start" : "end"} className="z-[80] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] border-border/45 bg-popover text-popover-foreground">
        <DropdownMenuLabel>Selecionar Unidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {unidades.map((unidade) => (
          <DropdownMenuItem
            key={unidade.id}
            onClick={() => setUnidadeAtual(unidade)}
            className="flex cursor-pointer items-center justify-between gap-2 text-popover-foreground focus:bg-primary/10 focus:text-foreground"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate">{unidade.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">{formatCnpj(unidade.cnpj)}</p>
              </div>
            </div>
            <Badge 
              variant={unidade.tipo === "matriz" ? "default" : "secondary"} 
              className="text-xs capitalize"
            >
              {unidade.tipo}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
