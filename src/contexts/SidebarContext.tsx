import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = "sidebar:collapsed";

function readInitial(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

const FALLBACK_SIDEBAR_CONTEXT: SidebarContextType = {
  collapsed: false,
  setCollapsed: () => {},
  toggle: () => {},
};

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    // Fallback for portals (parceiro, cliente, entregador) que não usam o Sidebar do ERP.
    return FALLBACK_SIDEBAR_CONTEXT;
  }
  return context;
}
