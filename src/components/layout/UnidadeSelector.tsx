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
    return <Skeleton className="h-9 w-32" />;
  }

  if (unidades.length === 0) {
    return null;
  }

  // If only one unidade, just show it without dropdown
  if (unidades.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-[120px]">
          {unidadeAtual?.nome}
        </span>
        <Badge variant="outline" className="text-xs capitalize">
          {unidadeAtual?.tipo}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" className="gap-1 sm:gap-2 h-9 px-2 sm:px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md min-w-0 max-w-[140px] sm:max-w-none">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate max-w-[70px] sm:max-w-[120px] lg:max-w-[180px] font-semibold text-xs sm:text-sm">
            {unidadeAtual?.nome || "Selecionar"}
          </span>
          <Badge variant="outline" className="text-xs capitalize hidden md:inline-flex border-primary-foreground/30 text-primary-foreground shrink-0">
            {unidadeAtual?.tipo}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Selecionar Unidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {unidades.map((unidade) => (
          <DropdownMenuItem
            key={unidade.id}
            onClick={() => setUnidadeAtual(unidade)}
            className="flex items-center justify-between cursor-pointer"
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
