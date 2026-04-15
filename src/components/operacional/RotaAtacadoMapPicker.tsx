import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Loader2, X, MapPin, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CidadeRota {
  nome: string;
  lat: number;
  lng: number;
  km: number;
}

interface SearchResult {
  nome: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface OrigemInfo {
  nome: string;
  lat: number;
  lng: number;
}

interface RotaAtacadoMapPickerProps {
  cidades: CidadeRota[];
  onCidadesChange: (cidades: CidadeRota[]) => void;
  totalKm: number;
  origem?: OrigemInfo | null;
}

async function searchCidades(query: string): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query.trim());
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=5&addressdetails=1`,
    { headers: { "Accept-Language": "pt-BR" } }
  );
  const data = await res.json();
  if (!data || !Array.isArray(data)) return [];
  return data.map((r: any) => {
    const addr = r.address || {};
    const nome = addr.city || addr.town || addr.village || addr.municipality || query;
    return {
      nome,
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
  });
}

async function getOSRMDistance(coords: { lat: number; lng: number }[]): Promise<number[]> {
  if (coords.length < 2) return coords.map(() => 0);
  const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=false&steps=false&annotations=false`
    );
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.legs) {
      return coords.map(() => 0);
    }
    const legs = data.routes[0].legs;
    const kms: number[] = [0];
    for (const leg of legs) {
      kms.push(Math.round((leg.distance / 1000) * 10) / 10);
    }
    return kms;
  } catch {
    return coords.map(() => 0);
  }
}

export function RotaAtacadoMapPicker({ cidades, onCidadesChange, totalKm }: RotaAtacadoMapPickerProps) {
  const { toast } = useToast();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [-23.55, -51.43],
      zoom: 7,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers and polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (cidades.length === 0) return;

    const bounds: L.LatLngExpression[] = [];
    cidades.forEach((c, i) => {
      const color = i === 0 ? "#22c55e" : "#3b82f6";
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindTooltip(`${i + 1}. ${c.nome}${c.km > 0 ? ` (${c.km} km)` : ""}`, { permanent: false })
        .addTo(map);
      markersRef.current.push(marker);
      bounds.push([c.lat, c.lng]);
    });

    if (cidades.length >= 2) {
      polylineRef.current = L.polyline(
        cidades.map((c) => [c.lat, c.lng] as L.LatLngExpression),
        { color: "#3b82f6", weight: 3, opacity: 0.7, dashArray: "8,6" }
      ).addTo(map);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [30, 30], maxZoom: 12 });
    }
  }, [cidades]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await searchCidades(searchQuery);
      if (results.length === 0) {
        toast({ title: "Nenhum resultado", description: "Tente outro nome de cidade.", variant: "destructive" });
      } else {
        setSearchResults(results);
      }
    } catch {
      toast({ title: "Erro na busca", variant: "destructive" });
    }
    setIsSearching(false);
  }, [searchQuery, toast]);

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      const newCidade: CidadeRota = { nome: result.nome, lat: result.lat, lng: result.lng, km: 0 };
      const updated = [...cidades, newCidade];

      // Calculate distances via OSRM
      if (updated.length >= 2) {
        const kms = await getOSRMDistance(updated);
        const withKm = updated.map((c, i) => ({ ...c, km: kms[i] || 0 }));
        onCidadesChange(withKm);
      } else {
        onCidadesChange(updated);
      }

      setSearchResults([]);
      setSearchQuery("");
    },
    [cidades, onCidadesChange]
  );

  const handleRemoveCidade = useCallback(
    async (index: number) => {
      const updated = cidades.filter((_, i) => i !== index);
      if (updated.length >= 2) {
        const kms = await getOSRMDistance(updated);
        onCidadesChange(updated.map((c, i) => ({ ...c, km: kms[i] || 0 })));
      } else {
        onCidadesChange(updated.map((c) => ({ ...c, km: 0 })));
      }
    },
    [cidades, onCidadesChange]
  );

  return (
    <div className="space-y-3">
      <Label>Buscar Cidade no Mapa</Label>
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ex: Londrina, PR"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button variant="outline" size="icon" onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <div className="border rounded-lg bg-card shadow-md max-h-40 overflow-y-auto">
          {searchResults.map((r, i) => (
            <button
              key={i}
              className="flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 text-sm transition-colors"
              onClick={() => handleSelectResult(r)}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <span className="font-medium">{r.nome}</span>
                <p className="text-xs text-muted-foreground line-clamp-1">{r.displayName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mini map */}
      <div
        ref={mapContainerRef}
        className="h-48 w-full rounded-lg border overflow-hidden"
        style={{ zIndex: 0 }}
      />

      {/* City list */}
      {cidades.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            Cidades na rota
          </Label>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {cidades.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground text-xs w-5">{i + 1}.</span>
                  <span>{c.nome}</span>
                  {c.km > 0 && <Badge variant="outline" className="text-xs">{c.km} km</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveCidade(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-sm font-medium">KM Total (rodoviário)</span>
            <Badge className="bg-primary text-primary-foreground">{Math.round(totalKm * 10) / 10} km</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
