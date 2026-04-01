import { useState, useCallback, useEffect } from "react";
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
  html: `<div style="background:#22c55e;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function stopIcon(index: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#3b82f6;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${index}</div>`,
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

function RouteMapViewport({ open, waypoints }: { open: boolean; waypoints: Waypoint[] }) {
  const map = useMap();

  useEffect(() => {
    const syncMap = () => {
      if (waypoints.length >= 2) {
        map.fitBounds(L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number])), {
          padding: [40, 40],
        });
      } else if (waypoints.length === 1) {
        map.flyTo([waypoints[0].lat, waypoints[0].lng], 14, { duration: 0.5 });
      } else {
        map.setView(DEFAULT_CENTER, 13);
      }

      map.invalidateSize();
    };

    syncMap();

    const t1 = window.setTimeout(() => map.invalidateSize(), 150);
    const t2 = window.setTimeout(() => map.invalidateSize(), 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, open, waypoints]);

  return null;
}

export function RouteMapDialog({ open, onOpenChange, onConfirm }: RouteMapDialogProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const totalKm = calcTotalKm(waypoints);

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
    if (!open) {
      setWaypoints([]);
      setSearchQuery("");
      setIsSearching(false);
      setIsGeocoding(false);
    }
  }, [open]);

  const handleSearch = async () => {
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
  };

  const undoLast = () => setWaypoints((prev) => prev.slice(0, -1));
  const clearAll = () => setWaypoints([]);

  const handleConfirm = () => {
    const km = Math.round(totalKm * 10) / 10;
    const lines = waypoints.map((w, i) => (i === 0 ? `Origem: ${w.label}` : `Parada ${i}: ${w.label}`));
    lines.push(`Total: ${km} km`);
    onConfirm(km, lines.join(" → "));
    setWaypoints([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col">
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
              <Undo2 className="h-4 w-4 mr-1" /> Desfazer
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={waypoints.length === 0}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </div>
        </div>

        <div className="h-[400px] rounded-lg overflow-hidden border border-border flex-1 min-h-[300px] bg-muted/20">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            className="h-full w-full"
            zoomControl
            attributionControl
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
            <RouteMapViewport open={open} waypoints={waypoints} />

            {waypoints.map((w, i) => (
              <Marker key={`${w.lat}-${w.lng}-${i}`} position={[w.lat, w.lng]} icon={i === 0 ? originIcon : stopIcon(i)} />
            ))}

            {waypoints.length >= 2 && (
              <Polyline
                positions={waypoints.map((w) => [w.lat, w.lng] as [number, number])}
                pathOptions={{ color: "#3b82f6", weight: 4, dashArray: "8 6" }}
              />
            )}
          </MapContainer>
        </div>

        {waypoints.length > 0 && (
          <div className="max-h-[120px] overflow-y-auto text-xs space-y-1 bg-muted/50 rounded-lg p-2">
            {waypoints.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`font-bold ${i === 0 ? "text-green-600" : "text-blue-600"}`}>
                  {i === 0 ? "A" : i}
                </span>
                <span className="text-muted-foreground truncate">{w.label}</span>
                {i > 0 && (
                  <span className="ml-auto text-foreground font-medium whitespace-nowrap">
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
