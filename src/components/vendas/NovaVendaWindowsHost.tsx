import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNovaVendaWindows } from "@/contexts/NovaVendaWindowsContext";
import { NovaVendaFloatingWindow } from "./NovaVendaFloatingWindow";

export function NovaVendaWindowsHost() {
  const { windows, restoreWindow, closeWindow } = useNovaVendaWindows();
  const minimized = windows.filter((w) => w.minimized);

  return (
    <>
      {windows.map((w, i) => (
        <NovaVendaFloatingWindow key={w.id} win={w} index={i} />
      ))}

      {minimized.length > 0 && (
        <div
          className={cn(
            "fixed left-0 right-0 z-[60] flex flex-wrap items-center gap-2 px-3 py-1.5",
            "bg-background/95 backdrop-blur border-t border-border shadow-lg",
            "bottom-16 md:bottom-0",
          )}
          role="toolbar"
          aria-label="Janelas minimizadas de Nova Venda"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Vendas abertas:
          </span>
          {minimized.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-2.5 pr-1 py-1 text-xs font-semibold text-primary"
            >
              <button
                type="button"
                className="flex items-center gap-1.5 max-w-[180px] truncate"
                onClick={() => restoreWindow(w.id)}
                title={`Restaurar ${w.title}`}
              >
                <ShoppingCart className="h-3 w-3 shrink-0" />
                <span className="truncate">{w.title}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={() => closeWindow(w.id)}
                aria-label="Fechar"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
