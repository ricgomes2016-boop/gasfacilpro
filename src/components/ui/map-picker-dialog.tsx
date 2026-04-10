import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, MapPin, Loader2 } from "lucide-react";
import { reverseGeocode, geocodeAddress, type GeocodingResult } from "@/lib/geocoding";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPosition?: { lat: number; lng: number } | null;
  onConfirm: (result: GeocodingResult) => void;
}

function ClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToPosition({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 16, { duration: 0.8 });
  }, [position, map]);
  return null;
}

export function MapPickerDialog({
  open,
  onOpenChange,
  initialPosition,
  onConfirm,
}: MapPickerDialogProps) {
  // Default to Cornélio Procópio, PR
  const defaultCenter: [number, number] = [-23.1811, -50.6477];
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(
    initialPosition ? [initialPosition.lat, initialPosition.lng] : null
  );
  const [geocodeResult, setGeocodeResult] = useState<GeocodingResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  useEffect(() => {
    if (open && initialPosition) {
      setMarkerPos([initialPosition.lat, initialPosition.lng]);
    }
  }, [open, initialPosition]);

  const handleLocationSelect = useCallback(async (lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
    setIsReversing(true);
    const result = await reverseGeocode(lat, lng);
    if (result) {
      setGeocodeResult(result);
    } else {
      setGeocodeResult({ latitude: lat, longitude: lng, displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    }
    setIsReversing(false);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const result = await geocodeAddress(searchQuery);
    if (result) {
      setMarkerPos([result.latitude, result.longitude]);
      setGeocodeResult(result);
    }
    setIsSearching(false);
  };

  const handleConfirm = () => {
    if (geocodeResult) {
      onConfirm(geocodeResult);
      onOpenChange(false);
    }
  };

  const center = markerPos || defaultCenter;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Selecionar Localização no Mapa
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {/* Search bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Buscar endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Map */}
          <div className="h-[350px] rounded-lg overflow-hidden border border-border">
            <MapContainer
              center={center}
              zoom={markerPos ? 16 : 14}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickHandler onLocationSelect={handleLocationSelect} />
              {markerPos && (
                <>
                  <Marker position={markerPos} icon={defaultIcon} />
                  <FlyToPosition position={markerPos} />
                </>
              )}
            </MapContainer>
          </div>

          {/* Selected address info */}
          {isReversing && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço...
            </p>
          )}
          {geocodeResult && !isReversing && (
            <div className="text-sm bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="font-medium">📍 {geocodeResult.endereco || geocodeResult.displayName}</p>
              {geocodeResult.bairro && <p className="text-muted-foreground">Bairro: {geocodeResult.bairro}</p>}
              {geocodeResult.cidade && <p className="text-muted-foreground">Cidade: {geocodeResult.cidade}</p>}
              <p className="text-xs text-muted-foreground">
                Lat: {geocodeResult.latitude.toFixed(6)} | Lng: {geocodeResult.longitude.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!geocodeResult}>
            Confirmar Localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
