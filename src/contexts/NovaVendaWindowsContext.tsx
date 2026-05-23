import { useSyncExternalStore, useCallback, ReactNode } from "react";

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

function persist(windows: NovaVendaWindowState[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
  } catch {}
}

// ===== Singleton store (module-level) =====
let state: NovaVendaWindowState[] = readInitial();
let zCounter = 1000;
const listeners = new Set<() => void>();

function emit() {
  persist(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return [] as NovaVendaWindowState[];
}

function bringToFront(id: string) {
  zCounter += 1;
  const z = zCounter;
  state = state.map((w) => (w.id === id ? { ...w, zIndex: z } : w));
  emit();
}

function openWindow({ clienteId, title }: OpenWindowArgs = {}) {
  zCounter += 1;
  const z = zCounter;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `nv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  state = [
    ...state,
    { id, clienteId: clienteId ?? null, title: title || "Nova Venda", minimized: false, maximized: false, zIndex: z },
  ];
  emit();
  return id;
}

function closeWindow(id: string) {
  state = state.filter((w) => w.id !== id);
  emit();
}

function minimizeWindow(id: string) {
  state = state.map((w) => (w.id === id ? { ...w, minimized: true } : w));
  emit();
}

function restoreWindow(id: string) {
  zCounter += 1;
  const z = zCounter;
  state = state.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: z } : w));
  emit();
}

function updateWindowTitle(id: string, title: string) {
  state = state.map((w) => (w.id === id ? { ...w, title } : w));
  emit();
}

function updateWindowPosition(id: string, x: number, y: number) {
  state = state.map((w) => (w.id === id ? { ...w, x, y } : w));
  emit();
}

function setWindowMaximized(id: string, maximized: boolean) {
  state = state.map((w) => (w.id === id ? { ...w, maximized } : w));
  emit();
}

// Provider mantido por compatibilidade (no-op) — o store é global.
export function NovaVendaWindowsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useNovaVendaWindows() {
  const windows = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    windows,
    openWindow: useCallback(openWindow, []),
    closeWindow: useCallback(closeWindow, []),
    minimizeWindow: useCallback(minimizeWindow, []),
    restoreWindow: useCallback(restoreWindow, []),
    bringToFront: useCallback(bringToFront, []),
    updateWindowTitle: useCallback(updateWindowTitle, []),
    updateWindowPosition: useCallback(updateWindowPosition, []),
    setWindowMaximized: useCallback(setWindowMaximized, []),
  };
}
