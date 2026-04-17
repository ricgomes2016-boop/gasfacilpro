import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";
import { toast } from "sonner";

export function GasmaisThemeQuickToggle() {
  const { isGasmais, setTheme } = useDashboardTheme();

  const handleToggle = () => {
    const next = isGasmais ? "default" : "gasmais";
    setTheme(next);
    toast.success(
      next === "gasmais"
        ? "Tema GásMais ativado no Dashboard e Sidebar"
        : "Tema padrão restaurado"
    );
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 hidden sm:inline-flex relative"
      onClick={handleToggle}
      title={isGasmais ? "Desativar tema GásMais" : "Ativar tema GásMais"}
    >
      <Palette className={`h-4 w-4 ${isGasmais ? "text-primary" : ""}`} />
      {isGasmais && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </Button>
  );
}
