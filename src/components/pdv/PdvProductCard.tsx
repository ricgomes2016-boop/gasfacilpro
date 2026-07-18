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
        "relative flex flex-col rounded-[18px] border bg-card p-3 transition-all",
        "shadow-[0_2px_10px_rgba(15,23,42,0.04)]",
        selecionado
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)]",
        semEstoque && "opacity-80"
      )}
    >
      {selecionado && (
        <span className="absolute -top-2 -right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shadow-md">
          {quantidadeNoCarrinho}
        </span>
      )}

      <div className={cn("h-11 w-11 shrink-0 rounded-xl overflow-hidden flex items-center justify-center", iconTone)}>
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
          <FallbackIcon className="h-5 w-5" />
        )}
      </div>

      <div className="mt-2 min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground min-h-[2.2em]">
          {produto.nome}
        </p>
        <p className={cn("mt-1 text-[15px] font-bold tabular-nums", semEstoque ? "text-muted-foreground" : "text-foreground")}>
          R$ {produto.preco.toFixed(2)}
        </p>
        {semEstoque ? (
          <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
            Sem estoque
          </span>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Estoque: <span className="font-semibold text-foreground tabular-nums">{estoque}</span>
          </p>
        )}
      </div>

      <div className="mt-2">
        {selecionado && onIncrement && onDecrement ? (
          <div className="flex items-center justify-between gap-1 rounded-xl border border-border bg-muted/40 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={onDecrement}
              aria-label="Diminuir"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm font-bold tabular-nums">{quantidadeNoCarrinho}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={onIncrement}
              disabled={semEstoque}
              aria-label="Aumentar"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            className="w-full h-10 rounded-xl text-[13px] font-semibold"
            onClick={onAdd}
            disabled={semEstoque}
            aria-label={`Adicionar ${produto.nome}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        )}
      </div>
    </div>
  );
}
