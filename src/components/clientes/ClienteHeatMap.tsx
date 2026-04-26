import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface ClienteGeo {
  id: string;
  nome: string;
  bairro: string | null;
  latitude: number;
  longitude: number;
}

interface BairroCluster {
  bairro: string;
  count: number;
  lat: number;
  lng: number;
  clientes: string[];
}

function FitBounds({ clusters }: { clusters: BairroCluster[] }) {
  const map = useMap();
  useEffect(() => {
    if (clusters.length === 0) return;
    const bounds = clusters.map(c => [c.lat, c.lng] as [number, number]);
    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [clusters, map]);
  return null;
}

export function ClienteHeatMap() {
  const [clusters, setClusters] = useState<BairroCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalGeo, setTotalGeo] = useState(0);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, bairro, latitude, longitude")
        .eq("ativo", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (!data) { setClusters([]); return; }

      setTotalGeo(data.length);

      // Group by bairro
      const bairroMap = new Map<string, ClienteGeo[]>();
      data.forEach((c: any) => {
        const key = c.bairro || "Sem bairro";
        if (!bairroMap.has(key)) bairroMap.set(key, []);
        bairroMap.get(key)!.push(c);
      });

      const result: BairroCluster[] = [];
      bairroMap.forEach((clientes, bairro) => {
        const avgLat = clientes.reduce((s, c) => s + c.latitude, 0) / clientes.length;
        const avgLng = clientes.reduce((s, c) => s + c.longitude, 0) / clientes.length;
        result.push({
          bairro,
          count: clientes.length,
          lat: avgLat,
          lng: avgLng,
          clientes: clientes.slice(0, 5).map(c => c.nome),
        });
      });

      result.sort((a, b) => b.count - a.count);
      setClusters(result);
    } catch (e) {
      console.error("Erro ao buscar clientes geolocalizados:", e);
    } finally {
      setLoading(false);
    }
  };

  const maxCount = Math.max(...clusters.map(c => c.count), 1);

  const getRadius = (count: number) => Math.max(10, (count / maxCount) * 40);
  const getColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return "hsl(0, 80%, 50%)";
    if (ratio > 0.4) return "hsl(30, 80%, 50%)";
    return "hsl(200, 70%, 50%)";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (clusters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa de Concentração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhum cliente com coordenadas geográficas cadastradas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa de Concentração
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {totalGeo} clientes geolocalizados • {clusters.length} regiões
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] rounded-lg overflow-hidden border">
          <MapContainer
            center={[clusters[0].lat, clusters[0].lng]}
            zoom={12}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds clusters={clusters} />
            {clusters.map((c) => (
              <CircleMarker
                key={c.bairro}
                center={[c.lat, c.lng]}
                radius={getRadius(c.count)}
                pathOptions={{
                  color: getColor(c.count),
                  fillColor: getColor(c.count),
                  fillOpacity: 0.5,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{c.bairro}</p>
                    <p>{c.count} cliente{c.count !== 1 ? "s" : ""}</p>
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {c.clientes.map((n, i) => (
                        <li key={i}>• {n}</li>
                      ))}
                      {c.count > 5 && <li>... e mais {c.count - 5}</li>}
                    </ul>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(200, 70%, 50%)" }} />
            Baixa
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(30, 80%, 50%)" }} />
            Média
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(0, 80%, 50%)" }} />
            Alta concentração
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
