import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PDVItem {
  id: string;
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
}

interface PDVProductListProps {
  itens: PDVItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onUpdatePrice?: (index: number, newPrice: number) => void;
}

export function PDVProductList({ itens, onUpdateQuantity, onRemoveItem, onUpdatePrice }: PDVProductListProps) {
  if (itens.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">Nenhum item</p>
          <p className="text-sm">Escaneie ou busque um produto</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 w-full min-w-0">
      <ul className="divide-y divide-border rounded-lg border border-border bg-card w-full min-w-0">
        {itens.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-2 px-2.5 py-2 w-full min-w-0"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-[13px] leading-tight text-foreground">{item.nome}</p>
              <div className="mt-0.5 flex items-center gap-1 min-w-0">
                <span className="text-[11px] text-muted-foreground shrink-0">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.preco_unitario}
                  onChange={(e) => onUpdatePrice?.(index, Number(e.target.value))}
                  className="w-16 h-6 text-[11px] px-1 min-w-0 tabular-nums"
                />
                <span className="text-[11px] text-muted-foreground shrink-0">/ un</span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0 rounded-md border border-border">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-none"
                onClick={() => onUpdateQuantity(index, -1)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                type="number"
                min="1"
                value={item.quantidade}
                onChange={(e) => {
                  const newQtd = parseInt(e.target.value) || 1;
                  if (newQtd >= 1) {
                    onUpdateQuantity(index, newQtd - item.quantidade);
                  }
                }}
                className="w-10 h-7 text-center text-[13px] font-semibold px-0 min-w-0 border-0 border-x rounded-none focus-visible:ring-0 tabular-nums"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-none"
                onClick={() => onUpdateQuantity(index, 1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="text-right min-w-[4.5rem] shrink-0">
              <p className="font-bold text-foreground text-[13.5px] tabular-nums">
                R$ {item.total.toFixed(2)}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemoveItem(index)}
              aria-label="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

