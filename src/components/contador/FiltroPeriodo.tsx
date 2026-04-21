import { CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePeriodo, PeriodoPreset } from "@/contexts/PeriodoContext";

export function FiltroPeriodo() {
  const { preset, setPreset, customInicio, customFim, setCustom, range } = usePeriodo();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wide hidden sm:inline">Período</span>
      </div>

      <Select value={preset} onValueChange={(v) => setPreset(v as PeriodoPreset)}>
        <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mes_atual">Mês atual</SelectItem>
          <SelectItem value="mes_anterior">Último mês</SelectItem>
          <SelectItem value="customizado">Customizado</SelectItem>
        </SelectContent>
      </Select>

      {preset === "customizado" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 px-3 text-xs justify-start font-normal bg-muted border-border text-foreground hover:bg-muted/70",
                !customInicio && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-2" />
              {customInicio && customFim
                ? `${format(customInicio, "dd/MM/yy")} – ${format(customFim, "dd/MM/yy")}`
                : "Escolher datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              locale={ptBR}
              selected={{ from: customInicio, to: customFim }}
              onSelect={(r) => setCustom(r?.from, r?.to)}
              numberOfMonths={2}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      <span className="hidden md:inline text-[10px] text-muted-foreground ml-1">{range.label}</span>
    </div>
  );
}
