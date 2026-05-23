import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";

export interface NovaVendaWindowState {
  id: string;
  clienteId?: string | null;
  title?: string;
  minimized: boolean;
  zIndex: number;
}

interface OpenWindowArgs {
  clienteId?: string | null;
  title?: string;
}

interface NovaVendaWindowsContextValue {
  windows: NovaVendaWindowState[];
  openWindow: (args?: OpenWindowArgs) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updateWindowTitle: (id: string, title: string) => void;
}

const NovaVendaWindowsContext = createContext<NovaVendaWindowsContextValue | null>(null);

export function NovaVendaWindowsProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<NovaVendaWindowState[]>([]);
  const zCounter = useRef(1000);

  const bringToFront = useCallback((id: string) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w)));
  }, []);

  const openWindow = useCallback(({ clienteId, title }: OpenWindowArgs = {}) => {
    zCounter.current += 1;
    const z = zCounter.current;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `nv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setWindows((prev) => [
      ...prev,
      { id, clienteId: clienteId ?? null, title: title || "Nova Venda", minimized: false, zIndex: z },
    ]);
    return id;
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: z } : w)));
  }, []);

  const updateWindowTitle = useCallback((id: string, title: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, title } : w)));
  }, []);

  const value = useMemo<NovaVendaWindowsContextValue>(
    () => ({ windows, openWindow, closeWindow, minimizeWindow, restoreWindow, bringToFront, updateWindowTitle }),
    [windows, openWindow, closeWindow, minimizeWindow, restoreWindow, bringToFront, updateWindowTitle],
  );

  return <NovaVendaWindowsContext.Provider value={value}>{children}</NovaVendaWindowsContext.Provider>;
}

export function useNovaVendaWindows() {
  const ctx = useContext(NovaVendaWindowsContext);
  if (!ctx) {
    // Fallback no-op para componentes montados fora do provider (não deve acontecer em produção).
    return {
      windows: [] as NovaVendaWindowState[],
      openWindow: () => "",
      closeWindow: () => {},
      minimizeWindow: () => {},
      restoreWindow: () => {},
      bringToFront: () => {},
      updateWindowTitle: () => {},
    } as NovaVendaWindowsContextValue;
  }
  return ctx;
}
