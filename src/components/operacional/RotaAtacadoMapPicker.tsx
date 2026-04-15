import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, X, MapPin, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CidadeRota {
  nome: string;
  lat: number;
  lng: number;
  km: number;
  opcional?: boolean;
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
  onTempoEstimadoChange?: (tempo: string) => void;
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

async function getIndividualKm(origem: OrigemInfo, cidade: { lat: number; lng: number }): Promise<number> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${cidade.lng},${cidade.lat}?overview=false`
    );
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]?.distance) {
      return Math.round((data.routes[0].distance / 1000) * 10) / 10;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function getFullRouteTime(origem: OrigemInfo, cidades: CidadeRota[]): Promise<number> {
  if (cidades.length === 0) return 0;
  // Sort by km ascending, build round trip: origin → cities sorted by distance → origin
  const sorted = [...cidades].sort((a, b) => a.km - b.km);
  const coords = [
    `${origem.lng},${origem.lat}`,
    ...sorted.map(c => `${c.lng},${c.lat}`),
    `${origem.lng},${origem.lat}`,
  ].join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`
    );
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]?.duration) {
      return Math.round(data.routes[0].duration / 60);
    }
    return 0;
  } catch {
    return 0;
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}min` : ""}` : `${m}min`;
}

export function RotaAtacadoMapPicker({ cidades, onCidadesChange, totalKm, origem, onTempoEstimadoChange }: RotaAtacadoMapPickerProps) {
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

    const bounds: L.LatLngExpression[] = [];

    if (origem) {
      const originMarker = L.circleMarker([origem.lat, origem.lng], {
        radius: 10,
        fillColor: "#ef4444",
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindTooltip(`🏭 ${origem.nome} (Origem)`, { permanent: false })
        .addTo(map);
      markersRef.current.push(originMarker);
      bounds.push([origem.lat, origem.lng]);
    }

    if (cidades.length === 0 && bounds.length > 0) {
      map.setView([origem!.lat, origem!.lng], 9);
      return;
    }

    // Sort by km for display
    const sorted = [...cidades].sort((a, b) => a.km - b.km);

    sorted.forEach((c, i) => {
      const color = c.opcional ? "#f59e0b" : "#3b82f6";
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: c.opcional ? 0.6 : 0.9,
      })
        .bindTooltip(`${c.nome} (${c.km} km)${c.opcional ? " [Opcional]" : ""}`, { permanent: false })
        .addTo(map);
      markersRef.current.push(marker);
      bounds.push([c.lat, c.lng]);
    });

    // Draw lines from origin to each city
    if (origem) {
      sorted.forEach(c => {
        const line = L.polyline([[origem.lat, origem.lng], [c.lat, c.lng]], {
          color: c.opcional ? "#f59e0b" : "#3b82f6",
          weight: 2,
          opacity: c.opcional ? 0.4 : 0.6,
          dashArray: c.opcional ? "4,8" : "8,6",
        }).addTo(map);
        // Store ref for cleanup (using markersRef hack - they all get removed)
      });
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [30, 30], maxZoom: 12 });
    }
  }, [cidades, origem]);

  const recalcAllKms = useCallback(async (cities: CidadeRota[]): Promise<CidadeRota[]> => {
    if (!origem || cities.length === 0) return cities.map(c => ({ ...c, km: 0 }));
    const kms = await Promise.all(cities.map(c => getIndividualKm(origem, c)));
    const updated = cities.map((c, i) => ({ ...c, km: kms[i] }));
    // Sort by km
    updated.sort((a, b) => a.km - b.km);
    // Calculate full route time
    const totalMin = await getFullRouteTime(origem, updated);
    onTempoEstimadoChange?.(totalMin > 0 ? formatDuration(totalMin) : "");
    return updated;
  }, [origem, onTempoEstimadoChange]);

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
      const newCidade: CidadeRota = { nome: result.nome, lat: result.lat, lng: result.lng, km: 0, opcional: false };
      const updated = await recalcAllKms([...cidades, newCidade]);
      onCidadesChange(updated);
      setSearchResults([]);
      setSearchQuery("");
    },
    [cidades, onCidadesChange, recalcAllKms]
  );

  const handleRemoveCidade = useCallback(
    async (index: number) => {
      // Find the city in sorted order by index
      const sorted = [...cidades].sort((a, b) => a.km - b.km);
      const cityToRemove = sorted[index];
      const remaining = cidades.filter(c => c !== cityToRemove);
      if (remaining.length === 0) {
        onCidadesChange([]);
        onTempoEstimadoChange?.("");
        return;
      }
      const updated = await recalcAllKms(remaining);
      onCidadesChange(updated);
    },
    [cidades, onCidadesChange, recalcAllKms, onTempoEstimadoChange]
  );

  const handleToggleOpcional = useCallback(
    async (index: number) => {
      const sorted = [...cidades].sort((a, b) => a.km - b.km);
      const city = sorted[index];
      const updated = cidades.map(c =>
        c === city ? { ...c, opcional: !c.opcional } : c
      );
      // Recalc time since optional cities affect the route
      if (origem) {
        const totalMin = await getFullRouteTime(origem, updated);
        onTempoEstimadoChange?.(totalMin > 0 ? formatDuration(totalMin) : "");
      }
      onCidadesChange(updated);
    },
    [cidades, onCidadesChange, origem, onTempoEstimadoChange]
  );

  // Sort for display
  const sortedCidades = [...cidades].sort((a, b) => a.km - b.km);

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

      <div
        ref={mapContainerRef}
        className="h-48 w-full rounded-lg border overflow-hidden"
        style={{ zIndex: 0 }}
      />

      {sortedCidades.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            Cidades na rota (ordenadas por distância)
          </Label>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {sortedCidades.map((c, i) => (
              <div key={`${c.nome}-${c.lat}`} className={`flex items-center justify-between rounded px-3 py-1.5 text-sm ${c.opcional ? "bg-muted/30 opacity-75" : "bg-muted/50"}`}>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={!c.opcional}
                    onCheckedChange={() => handleToggleOpcional(i)}
                    className="h-3.5 w-3.5"
                  />
                  <span className={c.opcional ? "line-through text-muted-foreground" : ""}>{c.nome}</span>
                  <Badge variant="outline" className="text-xs">{c.km} km</Badge>
                  {c.opcional && <Badge variant="secondary" className="text-xs">Opcional</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveCidade(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-sm font-medium">KM Total (cidade mais distante)</span>
            <Badge className="bg-primary text-primary-foreground">{Math.round(totalKm * 10) / 10} km</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
