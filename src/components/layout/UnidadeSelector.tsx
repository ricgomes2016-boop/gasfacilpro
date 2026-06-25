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
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Skeleton } from "@/components/ui/skeleton";

interface UnidadeSelectorProps {
  variant?: "header" | "sidebar";
}

export function UnidadeSelector({ variant = "header" }: UnidadeSelectorProps) {
  const { unidades, unidadeAtual, loading, setUnidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();

  if (variant === "sidebar") {
    if (loading) return <Skeleton className="h-14 w-full rounded-xl" />;
    const cnpj = (empresa as any)?.cnpj || (unidadeAtual as any)?.cnpj || "";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border/40 bg-sidebar-accent/5 px-3 py-2.5 text-left transition hover:bg-sidebar-accent/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/80 text-sidebar-accent-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12px] font-extrabold uppercase tracking-wide text-sidebar-foreground">
                {unidadeAtual?.nome || "Selecionar"}
              </p>
              {cnpj && (
                <p className="truncate text-[10px] font-medium text-sidebar-foreground/60">
                  {cnpj}
                </p>
              )}
            </div>
            {unidades.length > 1 && <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />}
          </button>
        </DropdownMenuTrigger>
        {unidades.length > 1 && (
          <DropdownMenuContent align="start" className="w-60 border-border/45 bg-popover text-popover-foreground">
            <DropdownMenuLabel>Selecionar Unidade</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {unidades.map((unidade) => (
              <DropdownMenuItem
                key={unidade.id}
                onClick={() => setUnidadeAtual(unidade)}
                className="flex cursor-pointer items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{unidade.nome}</span>
                </div>
                <Badge variant={unidade.tipo === "matriz" ? "default" : "secondary"} className="text-xs capitalize">
                  {unidade.tipo}
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  }

  if (loading) {
    return <Skeleton className="h-9 w-32 shrink-0 sm:w-36 xl:w-44" />;
  }

  if (unidades.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="header-unit-selector h-9 min-w-[128px] max-w-[46vw] shrink-0 gap-1 px-2 text-xs font-semibold sm:min-w-[144px] sm:max-w-[180px] xl:max-w-[220px]"
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">Sem loja</span>
      </Button>
    );
  }

  if (unidades.length === 1) {
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
        <Button variant="default" size="sm" className="header-unit-selector h-9 min-w-[128px] max-w-[46vw] shrink-0 gap-1 px-2 sm:min-w-[144px] sm:max-w-[180px] xl:max-w-[240px] xl:px-3">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
            {unidadeAtual?.nome || "Selecionar"}
          </span>
          <Badge variant="outline" className="text-xs capitalize hidden xl:inline-flex border-primary/20 bg-primary/10 text-primary shrink-0">
            {unidadeAtual?.tipo}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border/45 bg-popover text-popover-foreground">
        <DropdownMenuLabel>Selecionar Unidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {unidades.map((unidade) => (
          <DropdownMenuItem
            key={unidade.id}
            onClick={() => setUnidadeAtual(unidade)}
            className="flex cursor-pointer items-center justify-between gap-2 text-popover-foreground focus:bg-primary/10 focus:text-foreground"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{unidade.nome}</span>
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
