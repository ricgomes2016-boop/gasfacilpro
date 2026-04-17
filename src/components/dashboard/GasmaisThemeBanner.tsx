import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

const DISMISS_KEY = "gasmaisBannerDismissed";

export function GasmaisThemeBanner() {
  const { isGasmais, setTheme } = useDashboardTheme();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (isGasmais || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const handleActivate = () => {
    setTheme("gasmais");
    handleDismiss();
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-orange-400/50 bg-gradient-to-r from-orange-500/10 to-blue-500/10 p-3 sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
        <Sparkles className="h-5 w-5 text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Experimente o novo tema GásMais</p>
        <p className="text-xs text-muted-foreground">
          Visual moderno estilo fintech para Dashboard e Sidebar.
        </p>
      </div>
      <Button size="sm" onClick={handleActivate} className="shrink-0">
        Ativar
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleDismiss}
        title="Dispensar"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
