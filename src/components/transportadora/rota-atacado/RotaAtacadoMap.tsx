import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { geocodeAddress, reverseGeocode } from "@/lib/geocoding";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [-23.1811, -50.6477];

export type TipoParada = "saida" | "coleta" | "transferencia" | "venda" | "retorno";
export type ImpactoEstoque = "entrada" | "saida" | "nenhum";

export interface Parada {
  id: string;
  ordem: number;
  tipo_parada: TipoParada;
  cidade: string;
  endereco: string;
  lat: number;
  lng: number;
  qtd_p13: number;
  qtd_p20: number;
  qtd_p45: number;
  impacto_estoque: ImpactoEstoque;
  impacto_financeiro: boolean;
  entidade_id: string;
  entidade_tipo: string;
  entidade_nome: string;
  observacoes: string;
}

/** Defaults automáticos por tipo de parada */
export function getDefaultsByTipo(tipo: TipoParada): Pick<Parada, "impacto_estoque" | "impacto_financeiro"> {
  switch (tipo) {
    case "saida": return { impacto_estoque: "nenhum", impacto_financeiro: false };
    case "coleta": return { impacto_estoque: "entrada", impacto_financeiro: true };
    case "venda": return { impacto_estoque: "saida", impacto_financeiro: true };
    case "transferencia": return { impacto_estoque: "saida", impacto_financeiro: false };
    case "retorno": return { impacto_estoque: "nenhum", impacto_financeiro: false };
    default: return { impacto_estoque: "nenhum", impacto_financeiro: false };
  }
}

const PARADA_COLORS: Record<string, string> = {
  saida: "hsl(142 71% 45%)",
  coleta: "hsl(217 91% 60%)",
  transferencia: "hsl(270 70% 55%)",
  venda: "hsl(25 95% 53%)",
  retorno: "hsl(0 72% 51%)",
};

const PARADA_LABELS: Record<string, string> = {
  saida: "S",
  coleta: "C",
  transferencia: "T",
  venda: "V",
  retorno: "R",
};

function makeIcon(tipo: string, index: number) {
  const color = PARADA_COLORS[tipo] || "hsl(220 14% 46%)";
  const label = PARADA_LABELS[tipo] || String(index);
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function ClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onAdd(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FitBounds({ paradas }: { paradas: Parada[] }) {
  const map = useMap();
  useEffect(() => {
    if (paradas.length === 0) return;
    const bounds = L.latLngBounds(paradas.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, paradas]);
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

interface Props {
  paradas: Parada[];
  onAddParada: (lat: number, lng: number, endereco: string, cidade: string) => void;
}

export function RotaAtacadoMap({ paradas, onAddParada }: Props) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    const result = await reverseGeocode(lat, lng);
    const endereco = result?.endereco
      ? `${result.endereco}${result.bairro ? `, ${result.bairro}` : ""}`
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const cidade = result?.cidade || "";
    onAddParada(lat, lng, endereco, cidade);
  }, [onAddParada]);

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const result = await geocodeAddress(search);
      if (result) {
        const endereco = result.endereco
          ? `${result.endereco}${result.bairro ? `, ${result.bairro}` : ""}`
          : result.displayName;
        onAddParada(result.latitude, result.longitude, endereco, result.cidade || "");
        setSearch("");
      }
    } finally {
      setLoading(false);
    }
  }, [search, onAddParada]);

  const center = paradas.length > 0
    ? [paradas[paradas.length - 1].lat, paradas[paradas.length - 1].lng] as [number, number]
    : DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar endereço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      <div className="h-[400px] rounded-lg overflow-hidden border border-border">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onAdd={handleMapClick} />
          <InvalidateSize />
          {paradas.length > 0 && <FitBounds paradas={paradas} />}

          {paradas.map((p, i) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={makeIcon(p.tipo_parada, i)} />
          ))}

          {paradas.length >= 2 && (
            <Polyline
              positions={paradas.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "hsl(var(--primary))", weight: 3, dashArray: "8 6" }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(PARADA_COLORS).map(([tipo, color]) => (
          <span key={tipo} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
            {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
