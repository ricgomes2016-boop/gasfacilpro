import { useState, useEffect, useCallback } from "react";
import { BRAND_THEME_STORAGE_KEY, BrandThemeId, getBrandTheme } from "@/lib/brandThemes";

type DashboardTheme = BrandThemeId;
const STORAGE_KEY = BRAND_THEME_STORAGE_KEY;
const LEGACY_STORAGE_KEY = "dashboardTheme";

function read(): DashboardTheme {
  if (typeof window === "undefined") return "pastel-dashboard";
  const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (stored === "default") return "pastel-dashboard";
  if (!stored) return "pastel-dashboard";
  return getBrandTheme(stored).id;
}

export function useDashboardTheme() {
  const [theme, setThemeState] = useState<DashboardTheme>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) setThemeState(read());
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
    localStorage.setItem(LEGACY_STORAGE_KEY, t === "pastel-dashboard" ? "default" : t);
    setThemeState(t);
    window.dispatchEvent(new Event("dashboard-theme-change"));
  }, []);

  const brandTheme = getBrandTheme(theme);
  const themeClass = brandTheme.className;
  const isGasmais = theme === "gasmais";
  const isDashboardPastel = theme === "pastel-dashboard";
  return { theme, setTheme, themeClass, brandTheme, isGasmais, isDashboardPastel, isGasmaisDashboard: isGasmais || isDashboardPastel };
}
