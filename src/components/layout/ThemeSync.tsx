import { useEffect } from "react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, THEME_PRESETS, PRESET_THEME_OVERRIDES } from "@/lib/themeUtils";
import { BRAND_THEME_STORAGE_KEY } from "@/lib/brandThemes";

export function ThemeSync() {
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    if (!unidadeAtual) return;

    // Busca a configuração do banco
    supabase
      .from("configuracoes_visuais")
      .select("dark_mode, cor_primaria")
      .eq("unidade_id", unidadeAtual.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const matchedPreset = THEME_PRESETS.find(
            (p) =>
              p.cor === data.cor_primaria &&
              p.dark === data.dark_mode &&
              PRESET_THEME_OVERRIDES[p.id]
          );

          // Aplica cores e variáveis via utilitário
          applyTheme(data.dark_mode ?? false, data.cor_primaria ?? "187 65% 38%", matchedPreset?.id);

          // Sincroniza o localStorage para garantir que a classe brand-theme seja removida se for um tema clássico
          // e mantida se for um tema SaaS/Pastel
          const presetWithBrandThemeId = THEME_PRESETS.find(
            (p) => p.cor === data.cor_primaria && p.dark === data.dark_mode && "brandThemeId" in p
          );
          
          const currentBrandThemeId = localStorage.getItem(BRAND_THEME_STORAGE_KEY);
          const targetBrandThemeId = presetWithBrandThemeId
            ? (presetWithBrandThemeId as any).brandThemeId
            : (matchedPreset ? "classic" : "premium");

          if (currentBrandThemeId !== targetBrandThemeId) {
             localStorage.setItem(BRAND_THEME_STORAGE_KEY, targetBrandThemeId);
             window.dispatchEvent(new Event("dashboard-theme-change"));
          }
        } else {
           // Fallback to premium default
           applyTheme(false, "238 75% 58%", "premium-light");
           const current = localStorage.getItem(BRAND_THEME_STORAGE_KEY);
           if (current !== "premium") {
             localStorage.setItem(BRAND_THEME_STORAGE_KEY, "premium");
             window.dispatchEvent(new Event("dashboard-theme-change"));
           }
        }
      });
  }, [unidadeAtual?.id]);

  return null;
}
