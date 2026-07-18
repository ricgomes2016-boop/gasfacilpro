import { Button } from "@/components/ui/button";
import { Flame, Droplets, Package, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PdvProductLike {
  id: string;
  nome: string;
  preco: number;
  estoque: number | null;
  categoria?: string | null;
  image_url?: string | null;
}

interface PdvProductCardProps {
  produto: PdvProductLike;
  quantidadeNoCarrinho?: number;
  onAdd: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

export function PdvProductCard({
  produto,
  quantidadeNoCarrinho = 0,
  onAdd,
  onIncrement,
  onDecrement,
}: PdvProductCardProps) {
  const estoque = produto.estoque ?? 0;
  const semEstoque = estoque <= 0;
  const selecionado = quantidadeNoCarrinho > 0;

  const isGas = produto.categoria === "gas";
  const isAgua = produto.categoria === "agua";
  const FallbackIcon = isGas ? Flame : isAgua ? Droplets : Package;
  const iconTone = isGas
    ? "bg-primary/10 text-primary"
    : isAgua
    ? "bg-info/10 text-info"
    : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-2.5 transition-colors",
        selecionado
          ? "border-primary ring-1 ring-primary/40"
          : "border-border hover:border-primary/40",
        semEstoque && "opacity-70"
      )}
    >
      {selecionado && (
        <span className="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {quantidadeNoCarrinho}
        </span>
      )}

      <div className="flex items-start gap-2">
        <div className={cn("h-9 w-9 shrink-0 rounded-lg overflow-hidden flex items-center justify-center", iconTone)}>
          {produto.image_url ? (
            <img
              src={produto.image_url}
              alt={produto.nome}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <FallbackIcon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-foreground min-h-[2.1em]">
            {produto.nome}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className={cn("text-[15px] font-bold tabular-nums leading-none", semEstoque ? "text-muted-foreground" : "text-foreground")}>
          R$ {produto.preco.toFixed(2)}
        </p>
        {semEstoque ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
            Sem estoque
          </span>
        ) : (
          <span className="text-[10.5px] text-muted-foreground tabular-nums">
            Est. <span className="font-semibold text-foreground">{estoque}</span>
          </span>
        )}
      </div>

      <div className="mt-2">
        {selecionado && onIncrement && onDecrement ? (
          <div className="flex items-center justify-between gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={onDecrement}
              aria-label="Diminuir"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-bold tabular-nums">{quantidadeNoCarrinho}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={onIncrement}
              disabled={semEstoque}
              aria-label="Aumentar"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            className="w-full h-9 rounded-lg text-[12.5px] font-semibold"
            onClick={onAdd}
            disabled={semEstoque}
            aria-label={`Adicionar ${produto.nome}`}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar
          </Button>
        )}
      </div>
    </div>
  );
}
