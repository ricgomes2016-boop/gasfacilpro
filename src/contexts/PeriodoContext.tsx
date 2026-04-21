import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export type PeriodoPreset = "mes_atual" | "mes_anterior" | "customizado";

export interface PeriodoRange {
  inicio: Date;
  fim: Date;
  inicioISO: string; // YYYY-MM-DD
  fimISO: string;
  inicioISOFull: string; // ISO completo
  fimISOFull: string;
  label: string;
}

interface PeriodoContextType {
  preset: PeriodoPreset;
  setPreset: (p: PeriodoPreset) => void;
  customInicio: Date | undefined;
  customFim: Date | undefined;
  setCustom: (inicio: Date | undefined, fim: Date | undefined) => void;
  range: PeriodoRange;
}

const PeriodoContext = createContext<PeriodoContextType | undefined>(undefined);

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function buildRange(preset: PeriodoPreset, ci?: Date, cf?: Date): PeriodoRange {
  const hoje = new Date();
  let inicio: Date;
  let fim: Date;
  let label: string;

  if (preset === "mes_atual") {
    inicio = startOfMonth(hoje);
    fim = endOfMonth(hoje);
    label = format(hoje, "MM/yyyy");
  } else if (preset === "mes_anterior") {
    const prev = subMonths(hoje, 1);
    inicio = startOfMonth(prev);
    fim = endOfMonth(prev);
    label = format(prev, "MM/yyyy");
  } else {
    inicio = ci ?? startOfMonth(hoje);
    fim = cf ?? endOfMonth(hoje);
    label = `${format(inicio, "dd/MM/yy")} – ${format(fim, "dd/MM/yy")}`;
  }

  inicio.setHours(0, 0, 0, 0);
  const fimEnd = endOfDay(fim);

  return {
    inicio,
    fim: fimEnd,
    inicioISO: format(inicio, "yyyy-MM-dd"),
    fimISO: format(fimEnd, "yyyy-MM-dd"),
    inicioISOFull: inicio.toISOString(),
    fimISOFull: fimEnd.toISOString(),
    label,
  };
}

export function PeriodoProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<PeriodoPreset>("mes_atual");
  const [customInicio, setCustomInicio] = useState<Date | undefined>(undefined);
  const [customFim, setCustomFim] = useState<Date | undefined>(undefined);

  const range = useMemo(
    () => buildRange(preset, customInicio, customFim),
    [preset, customInicio, customFim]
  );

  const setCustom = (i: Date | undefined, f: Date | undefined) => {
    setCustomInicio(i);
    setCustomFim(f);
    if (i && f) setPreset("customizado");
  };

  return (
    <PeriodoContext.Provider
      value={{ preset, setPreset, customInicio, customFim, setCustom, range }}
    >
      {children}
    </PeriodoContext.Provider>
  );
}

export function usePeriodo() {
  const ctx = useContext(PeriodoContext);
  if (!ctx) throw new Error("usePeriodo must be used within PeriodoProvider");
  return ctx;
}
