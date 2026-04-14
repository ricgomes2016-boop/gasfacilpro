import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { haversineDistance } from "@/lib/haversine";
import type { Parada } from "./RotaAtacadoMap";

const ROAD_FACTOR = 1.3;

function calcTotalKm(paradas: Parada[]): number {
  let total = 0;
  for (let i = 1; i < paradas.length; i++) {
    total += haversineDistance(paradas[i - 1].lat, paradas[i - 1].lng, paradas[i].lat, paradas[i].lng);
  }
  return total * ROAD_FACTOR;
}

/** Nearest-neighbor, mantendo saida como primeiro e retorno como último */
function optimizeOrder(paradas: Parada[]): Parada[] {
  if (paradas.length <= 2) return paradas;

  const saida = paradas.filter((p) => p.tipo_parada === "saida");
  const retorno = paradas.filter((p) => p.tipo_parada === "retorno");
  const middle = paradas.filter((p) => p.tipo_parada !== "saida" && p.tipo_parada !== "retorno");

  if (middle.length <= 1) return [...saida, ...middle, ...retorno];

  // Nearest neighbor
  const ordered: Parada[] = [];
  const remaining = [...middle];
  let current = saida.length > 0 ? saida[saida.length - 1] : middle[0];

  if (saida.length === 0) {
    ordered.push(remaining.shift()!);
    current = ordered[0];
  }

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }

  return [...saida, ...ordered, ...retorno].map((p, i) => ({ ...p, ordem: i }));
}

interface Props {
  paradas: Parada[];
  onOptimize: (optimized: Parada[]) => void;
}

export function RotaOptimizer({ paradas, onOptimize }: Props) {
  const handleOptimize = () => {
    const before = calcTotalKm(paradas);
    const optimized = optimizeOrder(paradas);
    const after = calcTotalKm(optimized);
    onOptimize(optimized);

    return { before, after };
  };

  if (paradas.length < 3) return null;

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleOptimize}>
      <Sparkles className="h-4 w-4" />
      Otimizar Ordem
    </Button>
  );
}
