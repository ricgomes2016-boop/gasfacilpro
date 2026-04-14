import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haversineDistance } from "@/lib/haversine";
import { calcP13Equivalente, formatCurrency, formatNumber } from "@/lib/transp-utils";
import { MapPin, Clock, DollarSign, Gauge } from "lucide-react";
import type { Parada } from "./RotaAtacadoMap";

const ROAD_FACTOR = 1.3;
const AVG_SPEED_KMH = 60;

interface Props {
  paradas: Parada[];
  consumoKmLitro: number;
  precoCombustivel: number;
  custoPedagio: number;
  custoRefeicao: number;
  salarioMotorista: number;
  salarioAjudante: number;
  cargaInicial: { p13: number; p20: number; p45: number };
}

export function RotaSummaryCard({
  paradas,
  consumoKmLitro,
  precoCombustivel,
  custoPedagio,
  custoRefeicao,
  salarioMotorista,
  salarioAjudante,
  cargaInicial,
}: Props) {
  let kmTotal = 0;
  for (let i = 1; i < paradas.length; i++) {
    kmTotal += haversineDistance(paradas[i - 1].lat, paradas[i - 1].lng, paradas[i].lat, paradas[i].lng);
  }
  kmTotal *= ROAD_FACTOR;

  const tempoMin = (kmTotal / AVG_SPEED_KMH) * 60;
  const tempoH = Math.floor(tempoMin / 60);
  const tempoM = Math.round(tempoMin % 60);

  const custoCombustivel = consumoKmLitro > 0 ? (kmTotal / consumoKmLitro) * precoCombustivel : 0;
  const motoristaDiario = salarioMotorista / 30;
  const ajudanteDiario = salarioAjudante / 30;
  const custoTotal = custoCombustivel + custoPedagio + custoRefeicao + motoristaDiario + ajudanteDiario;

  const p13Equiv = calcP13Equivalente(cargaInicial.p13, cargaInicial.p20, cargaInicial.p45);
  const custoPorP13 = p13Equiv > 0 ? custoTotal / p13Equiv : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resumo da Rota</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Distância</p>
            <p className="text-sm font-bold">{formatNumber(kmTotal, 1)} km</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Tempo Estimado</p>
            <p className="text-sm font-bold">{tempoH}h {tempoM}min</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Custo Total</p>
            <p className="text-sm font-bold">{formatCurrency(custoTotal)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Custo/P13 eq</p>
            <p className="text-sm font-bold">{formatCurrency(custoPorP13)}</p>
          </div>
        </div>

        <div className="col-span-2 text-xs text-muted-foreground space-y-0.5 border-t border-border pt-2">
          <p>Combustível: {formatCurrency(custoCombustivel)}</p>
          <p>Pedágio: {formatCurrency(custoPedagio)} · Refeição: {formatCurrency(custoRefeicao)}</p>
          <p>Motorista: {formatCurrency(motoristaDiario)} · Ajudante: {formatCurrency(ajudanteDiario)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
