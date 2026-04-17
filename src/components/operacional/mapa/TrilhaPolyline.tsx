import { Polyline } from "react-leaflet";
import { useMemo } from "react";
import type { PontoGPS } from "@/hooks/useMapaOperacionalData";

const CORES = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
  "hsl(346, 77%, 50%)",
  "hsl(38, 92%, 50%)",
  "hsl(190, 95%, 39%)",
];

interface Props {
  pontosCache: Record<string, PontoGPS[]>;
  selectedEntregador?: string | null;
}

export function TrilhaPolyline({ pontosCache, selectedEntregador }: Props) {
  const trilhas = useMemo(() => {
    return Object.entries(pontosCache)
      .filter(([eid, pts]) => pts.length > 1 && (!selectedEntregador || selectedEntregador === eid))
      .map(([eid, pts], idx) => ({
        eid,
        cor: CORES[idx % CORES.length],
        pontos: pts.map((p) => [p.lat, p.lng] as [number, number]),
      }));
  }, [pontosCache, selectedEntregador]);

  return (
    <>
      {trilhas.map((t) => (
        <Polyline
          key={`trilha-${t.eid}`}
          positions={t.pontos}
          pathOptions={{ color: t.cor, weight: 4, opacity: 0.75 }}
        />
      ))}
    </>
  );
}
