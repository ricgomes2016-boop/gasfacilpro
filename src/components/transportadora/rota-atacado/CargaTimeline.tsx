import { useMemo } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Minus, DollarSign } from "lucide-react";
import { calcP13Equivalente } from "@/lib/transp-utils";
import type { Parada } from "./RotaAtacadoMap";

interface Props {
  paradas: Parada[];
  cargaInicial: { p13: number; p20: number; p45: number };
  capacidade: { p13: number; p20: number; p45: number };
}

interface TimelineStep {
  parada: Parada;
  cargaP13: number;
  cargaP20: number;
  cargaP45: number;
  cargaP13Equiv: number;
  excedeu: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  saida: "Saída",
  coleta: "Coleta",
  transferencia: "Transf.",
  venda: "Venda",
  retorno: "Retorno",
};

export function CargaTimeline({ paradas, cargaInicial, capacidade }: Props) {
  const capacidadeP13Equiv = calcP13Equivalente(capacidade.p13, capacidade.p20, capacidade.p45);

  const steps = useMemo<TimelineStep[]>(() => {
    let p13 = cargaInicial.p13;
    let p20 = cargaInicial.p20;
    let p45 = cargaInicial.p45;

    return paradas.map((parada) => {
      if (parada.impacto_estoque === "entrada") {
        p13 += parada.qtd_p13;
        p20 += parada.qtd_p20;
        p45 += parada.qtd_p45;
      } else if (parada.impacto_estoque === "saida") {
        p13 -= parada.qtd_p13;
        p20 -= parada.qtd_p20;
        p45 -= parada.qtd_p45;
      }
      const equiv = calcP13Equivalente(Math.max(0, p13), Math.max(0, p20), Math.max(0, p45));
      return {
        parada,
        cargaP13: p13,
        cargaP20: p20,
        cargaP45: p45,
        cargaP13Equiv: equiv,
        excedeu: capacidadeP13Equiv > 0 && equiv > capacidadeP13Equiv,
      };
    });
  }, [paradas, cargaInicial, capacidadeP13Equiv]);

  if (paradas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Adicione paradas para ver a timeline de carga.</p>;
  }

  const cargaInicialEquiv = calcP13Equivalente(cargaInicial.p13, cargaInicial.p20, cargaInicial.p45);

  return (
    <div className="space-y-1">
      {/* Carga inicial */}
      <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50 border border-border">
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium">Carga Inicial</span>
        <span className="ml-auto text-muted-foreground">
          {cargaInicial.p13}×P13 · {cargaInicial.p20}×P20 · {cargaInicial.p45}×P45
          <span className="font-bold text-foreground ml-1">({cargaInicialEquiv.toFixed(0)} eq)</span>
        </span>
      </div>

      {steps.map((step, i) => {
        const impacto = step.parada.impacto_estoque;
        const isEntrada = impacto === "entrada";
        const isSaida = impacto === "saida";
        const tipoLabel = TIPO_LABELS[step.parada.tipo_parada] || step.parada.tipo_parada;

        return (
          <div
            key={step.parada.id}
            className={`flex items-center gap-2 text-xs p-2 rounded-md border ${
              step.excedeu ? "border-destructive bg-destructive/10" : "border-border bg-card"
            }`}
          >
            <div className="flex flex-col items-center shrink-0">
              <div className="w-px h-2 bg-border" />
              {isEntrada ? (
                <ArrowDown className="h-4 w-4 text-primary" />
              ) : isSaida ? (
                <ArrowUp className="h-4 w-4 text-accent-foreground" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">
                  #{i + 1} {step.parada.entidade_nome || step.parada.cidade || step.parada.endereco}
                </span>
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                  {tipoLabel}
                </span>
                {step.parada.impacto_financeiro && (
                  <DollarSign className="h-3 w-3 text-primary shrink-0" />
                )}
              </div>
              {(isEntrada || isSaida) && (
                <span className="text-muted-foreground">
                  {isEntrada ? "+" : "-"}{step.parada.qtd_p13}P13 {isEntrada ? "+" : "-"}{step.parada.qtd_p20}P20 {isEntrada ? "+" : "-"}{step.parada.qtd_p45}P45
                </span>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-muted-foreground text-[10px]">
                {step.cargaP13}P13 {step.cargaP20}P20 {step.cargaP45}P45
              </div>
              <span className={`font-bold ${step.excedeu ? "text-destructive" : "text-foreground"}`}>
                {step.cargaP13Equiv.toFixed(0)} eq
              </span>
              {step.excedeu && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Excede!</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
