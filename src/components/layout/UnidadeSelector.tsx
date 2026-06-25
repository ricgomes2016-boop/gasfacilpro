import { Building2, ChevronDown } from "lucide-react";
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
  const isSidebar = variant === "sidebar";

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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-background/70">
            <Building2 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold uppercase tracking-wide">{unidadeAtual?.nome || "Unidade"}</span>
                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                  {unidadeAtual?.tipo}
                </Badge>
              </div>
              <p className="mt-1 truncate text-[11px] font-medium text-sidebar-foreground/70">
                {formatCnpj(unidadeAtual?.cnpj)}
              </p>
            </div>
          )}
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
        <Button
          variant={isSidebar ? "outline" : "default"}
          size="sm"
          className={cn(
            isSidebar
              ? "sidebar-unit-selector h-auto min-h-20 w-full justify-start gap-3 rounded-md px-3 py-3 text-left"
              : "header-unit-selector h-9 min-w-[128px] max-w-[46vw] shrink-0 gap-1 px-2 sm:min-w-[144px] sm:max-w-[180px] xl:max-w-[240px] xl:px-3"
          )}
        >
          {isSidebar ? (
            <>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-background/70">
                <Building2 className="h-5 w-5" />
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold uppercase tracking-wide">{unidadeAtual?.nome || "Selecionar"}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                        {unidadeAtual?.tipo}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-sidebar-foreground/70">
                      {formatCnpj(unidadeAtual?.cnpj)}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </>
              )}
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
                {unidadeAtual?.nome || "Selecionar"}
              </span>
              <Badge variant="outline" className="text-xs capitalize hidden xl:inline-flex border-primary/20 bg-primary/10 text-primary shrink-0">
                {unidadeAtual?.tipo}
              </Badge>
              <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isSidebar ? "start" : "end"} className="w-64 border-border/45 bg-popover text-popover-foreground">
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
