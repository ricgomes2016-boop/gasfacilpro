import { useState, useEffect, useCallback } from "react";

type DashboardTheme = "default" | "gasmais";
const STORAGE_KEY = "dashboardTheme";

function read(): DashboardTheme {
  if (typeof window === "undefined") return "default";
  return (localStorage.getItem(STORAGE_KEY) as DashboardTheme) || "default";
}

export function useDashboardTheme() {
  const [theme, setThemeState] = useState<DashboardTheme>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(read());
    };
    window.addEventListener("storage", onStorage);
    const onCustom = () => setThemeState(read());
    window.addEventListener("dashboard-theme-change", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dashboard-theme-change", onCustom);
    };
  }, []);

  const setTheme = useCallback((t: DashboardTheme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    window.dispatchEvent(new Event("dashboard-theme-change"));
  }, []);

  const themeClass = theme === "gasmais" ? "theme-gasmais" : "";
  return { theme, setTheme, themeClass, isGasmais: theme === "gasmais" };
}
