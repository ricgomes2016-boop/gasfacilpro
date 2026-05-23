import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";

export interface NovaVendaWindowState {
  id: string;
  clienteId?: string | null;
  title?: string;
  minimized: boolean;
  maximized?: boolean;
  x?: number;
  y?: number;
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
  updateWindowPosition: (id: string, x: number, y: number) => void;
  setWindowMaximized: (id: string, maximized: boolean) => void;
}

const NovaVendaWindowsContext = createContext<NovaVendaWindowsContextValue | null>(null);

const STORAGE_KEY = "nova-venda:windows:v1";

function readInitial(): NovaVendaWindowState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w) => w && typeof w.id === "string");
  } catch {
    return [];
  }
}

export function NovaVendaWindowsProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<NovaVendaWindowState[]>(readInitial);
  const zCounter = useRef(1000);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
    } catch {}
  }, [windows]);

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
      { id, clienteId: clienteId ?? null, title: title || "Nova Venda", minimized: false, maximized: false, zIndex: z },
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

  const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const setWindowMaximized = useCallback((id: string, maximized: boolean) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized } : w)));
  }, []);

  const value = useMemo<NovaVendaWindowsContextValue>(
    () => ({
      windows,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      bringToFront,
      updateWindowTitle,
      updateWindowPosition,
      setWindowMaximized,
    }),
    [
      windows,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      bringToFront,
      updateWindowTitle,
      updateWindowPosition,
      setWindowMaximized,
    ],
  );

  return <NovaVendaWindowsContext.Provider value={value}>{children}</NovaVendaWindowsContext.Provider>;
}

export function useNovaVendaWindows() {
  const ctx = useContext(NovaVendaWindowsContext);
  if (!ctx) {
    return {
      windows: [] as NovaVendaWindowState[],
      openWindow: () => "",
      closeWindow: () => {},
      minimizeWindow: () => {},
      restoreWindow: () => {},
      bringToFront: () => {},
      updateWindowTitle: () => {},
      updateWindowPosition: () => {},
      setWindowMaximized: () => {},
    } as NovaVendaWindowsContextValue;
  }
  return ctx;
}
