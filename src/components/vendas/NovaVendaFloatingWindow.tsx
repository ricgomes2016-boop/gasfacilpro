import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2, Minus, ShoppingCart, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNovaVendaWindows, type NovaVendaWindowState } from "@/contexts/NovaVendaWindowsContext";

const NovaVenda = lazy(() => import("@/pages/vendas/NovaVenda"));

interface Props {
  win: NovaVendaWindowState;
  index: number;
}

export function NovaVendaFloatingWindow({ win, index }: Props) {
  const { closeWindow, minimizeWindow, bringToFront } = useNovaVendaWindows();
  const [maximized, setMaximized] = useState(false);
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 80, y: 60 };
    const offset = (index % 6) * 32;
    const baseW = Math.min(1100, window.innerWidth * 0.95);
    const baseH = Math.min(800, window.innerHeight * 0.85);
    return {
      x: Math.max(8, (window.innerWidth - baseW) / 2 + offset),
      y: Math.max(8, (window.innerHeight - baseH) / 2 + offset - 40),
    };
  });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDownHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    if (maximized) return;
    bringToFront(win.id);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMoveHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const nx = Math.max(0, Math.min(window.innerWidth - 200, dragState.current.origX + dx));
    const ny = Math.max(0, Math.min(window.innerHeight - 80, dragState.current.origY + dy));
    setPos({ x: nx, y: ny });
  };

  const onPointerUpHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  useEffect(() => {
    if (win.minimized) return;
    bringToFront(win.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.minimized]);

  const baseW = typeof window !== "undefined" ? Math.min(1100, window.innerWidth * 0.95) : 1000;
  const baseH = typeof window !== "undefined" ? Math.min(800, window.innerHeight * 0.85) : 720;

  const style: React.CSSProperties = maximized
    ? { position: "fixed", left: 0, top: 0, width: "100vw", height: "100dvh", zIndex: win.zIndex }
    : { position: "fixed", left: pos.x, top: pos.y, width: baseW, height: baseH, zIndex: win.zIndex };

  return (
    <div
      style={style}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-background shadow-2xl ring-1 ring-black/10 overflow-hidden",
        win.minimized && "hidden",
      )}
      onMouseDown={() => bringToFront(win.id)}
      role="dialog"
      aria-label={win.title || "Nova Venda"}
    >
      <div
        onPointerDown={onPointerDownHeader}
        onPointerMove={onPointerMoveHeader}
        onPointerUp={onPointerUpHeader}
        onPointerCancel={onPointerUpHeader}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 border-b bg-primary/5 shrink-0 select-none",
          !maximized && "cursor-move",
        )}
      >
        <div className="flex items-center gap-2 min-w-0 text-sm font-semibold">
          <ShoppingCart className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{win.title || "Nova Venda"}</span>
        </div>
        <div data-no-drag className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => minimizeWindow(win.id)}
            title="Minimizar"
            aria-label="Minimizar"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMaximized((m) => !m)}
            title={maximized ? "Restaurar" : "Maximizar"}
            aria-label={maximized ? "Restaurar" : "Maximizar"}
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => closeWindow(win.id)}
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <NovaVenda
            embedded
            initialClienteId={win.clienteId ?? null}
            onClose={() => closeWindow(win.id)}
          />
        </Suspense>
      </div>
    </div>
  );
}
