import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Search, MapPin, Loader2, Undo2, Trash2, Route } from "lucide-react";
import { reverseGeocode, geocodeAddress } from "@/lib/geocoding";
import { haversineDistance } from "@/lib/haversine";
import "leaflet/dist/leaflet.css";

const ROAD_FACTOR = 1.3;
const DEFAULT_CENTER: [number, number] = [-23.1811, -50.6477];

const originIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(var(--success));color:hsl(var(--success-foreground));width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:2px solid hsl(var(--background));box-shadow:0 2px 6px hsl(220 20% 10% / 0.25);">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function stopIcon(index: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:hsl(var(--accent));color:hsl(var(--accent-foreground));width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid hsl(var(--background));box-shadow:0 2px 6px hsl(220 20% 10% / 0.25);">${index}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

interface Waypoint {
  lat: number;
  lng: number;
  label: string;
}

interface RouteMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (km: number, summary: string) => void;
}

function calcTotalKm(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineDistance(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng);
  }
  return total * ROAD_FACTOR;
}

function RouteMapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function RouteMapInvalidateOnOpen({ open }: { open: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!open) return;

    map.invalidateSize();

    const t1 = window.setTimeout(() => map.invalidateSize(), 150);
    const t2 = window.setTimeout(() => map.invalidateSize(), 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, open]);

  return null;
}

function RouteMapCenter({ position }: { position: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    map.flyTo(position, Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [map, position]);

  return null;
}

export function RouteMapDialog({ open, onOpenChange, onConfirm }: RouteMapDialogProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [shouldMountMap, setShouldMountMap] = useState(false);

  const totalKm = useMemo(() => calcTotalKm(waypoints), [waypoints]);
  const lastPosition = waypoints.length > 0
    ? ([waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng] as [number, number])
    : null;

  const addWaypoint = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);

    try {
      const result = await reverseGeocode(lat, lng);
      const label = result?.endereco
        ? `${result.endereco}${result.bairro ? `, ${result.bairro}` : ""}${result.cidade ? ` - ${result.cidade}` : ""}`
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      setWaypoints((prev) => [...prev, { lat, lng, label }]);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => setShouldMountMap(true), 80);

      return () => {
        window.clearTimeout(timer);
      };
    }

    setShouldMountMap(false);
    setWaypoints([]);
    setSearchQuery("");
    setIsSearching(false);
    setIsGeocoding(false);
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);

    try {
      const result = await geocodeAddress(searchQuery);

      if (result) {
        const label = result.endereco
          ? `${result.endereco}${result.bairro ? `, ${result.bairro}` : ""}${result.cidade ? ` - ${result.cidade}` : ""}`
          : result.displayName;

        setWaypoints((prev) => [
          ...prev,
          { lat: result.latitude, lng: result.longitude, label },
        ]);
        setSearchQuery("");
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const undoLast = useCallback(() => setWaypoints((prev) => prev.slice(0, -1)), []);
  const clearAll = useCallback(() => setWaypoints([]), []);

  const handleConfirm = useCallback(() => {
    const km = Math.round(totalKm * 10) / 10;
    const lines = waypoints.map((w, i) => (i === 0 ? `Origem: ${w.label}` : `Parada ${i}: ${w.label}`));
    lines.push(`Total: ${km} km`);
    onConfirm(km, lines.join(" → "));
    setWaypoints([]);
    onOpenChange(false);
  }, [onConfirm, onOpenChange, totalKm, waypoints]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" /> Criar Rota no Mapa
          </DialogTitle>
          <DialogDescription>
            Defina origem e paradas no mapa para calcular a quilometragem automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Buscar endereço e adicionar à rota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {waypoints.length === 0
              ? "Clique no mapa para definir a origem"
              : `${waypoints.length} ponto(s) · `}
          </span>
          {waypoints.length > 0 && <span className="font-bold text-foreground">{totalKm.toFixed(1)} km</span>}
          {isGeocoding && <Loader2 className="h-3 w-3 animate-spin" />}
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={undoLast} disabled={waypoints.length === 0}>
              <Undo2 className="mr-1 h-4 w-4" /> Desfazer
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={waypoints.length === 0}>
              <Trash2 className="mr-1 h-4 w-4" /> Limpar
            </Button>
          </div>
        </div>

        <div className="h-[400px] rounded-lg overflow-hidden border border-border bg-muted/20">
          {shouldMountMap ? (
            <MapContainer
              key="route-map"
              center={lastPosition ?? DEFAULT_CENTER}
              zoom={lastPosition ? 14 : 13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RouteMapClickHandler
                onMapClick={(lat, lng) => {
                  void addWaypoint(lat, lng);
                }}
              />
              <RouteMapInvalidateOnOpen open={open} />
              <RouteMapCenter position={lastPosition} />

              {waypoints.map((w, i) => (
                <Marker key={`${w.lat}-${w.lng}-${i}`} position={[w.lat, w.lng]} icon={i === 0 ? originIcon : stopIcon(i)} />
              ))}

              {waypoints.length >= 2 && (
                <Polyline
                  positions={waypoints.map((w) => [w.lat, w.lng] as [number, number])}
                  pathOptions={{ color: "hsl(var(--accent))", weight: 4, dashArray: "8 6" }}
                />
              )}
            </MapContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mapa...
            </div>
          )}
        </div>

        {waypoints.length > 0 && (
          <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-2 text-xs">
            {waypoints.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`font-bold ${i === 0 ? "text-primary" : "text-accent"}`}>
                  {i === 0 ? "A" : i}
                </span>
                <span className="truncate text-muted-foreground">{w.label}</span>
                {i > 0 && (
                  <span className="ml-auto whitespace-nowrap font-medium text-foreground">
                    +{(haversineDistance(waypoints[i - 1].lat, waypoints[i - 1].lng, w.lat, w.lng) * ROAD_FACTOR).toFixed(1)} km
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={waypoints.length < 2}>
            Confirmar Rota ({totalKm.toFixed(1)} km)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
