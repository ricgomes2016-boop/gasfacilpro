import { CircleMarker, Tooltip } from "react-leaflet";
import { useMemo } from "react";

interface Props {
  dadosOp: Record<string, any>;
  selectedEntregador?: string | null;
}

export function ParadasLayer({ dadosOp, selectedEntregador }: Props) {
  const paradas = useMemo(() => {
    const out: { lat: number; lng: number; min: number; eid: string }[] = [];
    Object.entries(dadosOp || {}).forEach(([eid, info]: [string, any]) => {
      if (selectedEntregador && selectedEntregador !== eid) return;
      (info?.paradas || []).forEach((p: any) => {
        out.push({
          lat: p.latitude,
          lng: p.longitude,
          min: Math.round((p.tempoParado || 0) / 60),
          eid,
        });
      });
    });
    return out;
  }, [dadosOp, selectedEntregador]);

  return (
    <>
      {paradas.map((p, i) => (
        <CircleMarker
          key={`parada-${p.eid}-${i}`}
          center={[p.lat, p.lng]}
          radius={8}
          pathOptions={{
            color: "hsl(var(--destructive))",
            fillColor: "hsl(var(--destructive))",
            fillOpacity: 0.7,
            weight: 2,
          }}
        >
          <Tooltip direction="top">Parado {p.min} min</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
