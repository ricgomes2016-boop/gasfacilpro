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

export function UnidadeSelector() {
  const { unidades, unidadeAtual, loading, setUnidadeAtual } = useUnidade();

  if (loading) {
    return <Skeleton className="h-9 w-24 md:w-28 shrink-0" />;
  }

  if (unidades.length === 0) {
    return null;
  }

  // If only one unidade, just show it without dropdown
  if (unidades.length === 1) {
    return (
      <div className="flex h-9 items-center gap-1.5 min-w-0 max-w-[120px] md:max-w-[150px] xl:max-w-[220px] shrink-0 px-2 xl:px-3 py-1.5 rounded-md border border-border/45 bg-card text-card-foreground shadow-sm">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs md:text-sm font-semibold truncate min-w-0 text-foreground">
          {unidadeAtual?.nome}
        </span>
        <Badge variant="outline" className="text-xs capitalize hidden xl:inline-flex shrink-0">
          {unidadeAtual?.tipo}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" className="gap-1 h-9 px-2 xl:px-3 gradient-primary text-primary-foreground hover:opacity-95 shadow-md shadow-primary/20 min-w-0 max-w-[112px] sm:max-w-[130px] lg:max-w-[150px] xl:max-w-[220px] shrink-0">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate min-w-0 font-semibold text-xs sm:text-sm">
            {unidadeAtual?.nome || "Selecionar"}
          </span>
          <Badge variant="outline" className="text-xs capitalize hidden xl:inline-flex border-primary-foreground/35 bg-primary-foreground/12 text-primary-foreground shrink-0">
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
