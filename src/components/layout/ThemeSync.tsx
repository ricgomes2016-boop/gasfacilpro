import { useEffect } from "react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import {
  applyTheme,
  DASHBOARD_PASTEL_BRAND_THEME_ID,
  DASHBOARD_PASTEL_PRESET_ID,
  DASHBOARD_PASTEL_PRIMARY,
} from "@/lib/themeUtils";
import { BRAND_THEME_STORAGE_KEY } from "@/lib/brandThemes";

function syncDashboardPastel() {
  applyTheme(false, DASHBOARD_PASTEL_PRIMARY, DASHBOARD_PASTEL_PRESET_ID);

  const currentBrandThemeId = localStorage.getItem(BRAND_THEME_STORAGE_KEY);
  if (currentBrandThemeId !== DASHBOARD_PASTEL_BRAND_THEME_ID) {
    localStorage.setItem(BRAND_THEME_STORAGE_KEY, DASHBOARD_PASTEL_BRAND_THEME_ID);
    window.dispatchEvent(new Event("dashboard-theme-change"));
  }
}

export function ThemeSync() {
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    if (!unidadeAtual) return;

    supabase
      .from("configuracoes_visuais")
      .select("id")
      .eq("unidade_id", unidadeAtual.id)
      .maybeSingle()
      .finally(syncDashboardPastel);
  }, [unidadeAtual?.id]);

  return null;
}
