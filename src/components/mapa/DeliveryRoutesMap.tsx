import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createEntregadorIcon, createClienteIcon, createPercursoIcon } from "./EntregadorMarker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Navigation, User, MapPin } from "lucide-react";
import { NearestDriversPanel } from "./NearestDriversPanel";
import { haversineDistance } from "@/lib/haversine";

const GPS_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isGpsOffline(updatedAt?: string): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > GPS_OFFLINE_THRESHOLD_MS;
}

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface Entregador {
  id: string;
  nome: string;
  status: "em_rota" | "disponivel" | "offline";
  lat: number;
  lng: number;
  ultimaAtualizacao: string;
  updatedAt?: string; // ISO timestamp for GPS freshness check
  entregaAtual?: string;
  veiculo?: string;
  kmInicial?: number;
}

export interface ClienteEntrega {
  id: string;
  cliente: string;
  endereco: string;
  lat: number;
  lng: number;
  status: "pendente" | "em_rota" | "entregue";
  entregadorId?: string;
  horarioPrevisto: string;
}

export interface PercursoPonto {
  lat: number;
  lng: number;
  hora: string;
}

interface DeliveryRoutesMapProps {
  entregadores: Entregador[];
  clientes: ClienteEntrega[];
  percurso?: PercursoPonto[];
  selectedEntregador?: string | null;
  onSelectEntregador?: (id: string | null) => void;
  showPercurso?: boolean;
  defaultCenter?: [number, number];
  onSelectCliente?: (cliente: ClienteEntrega | null) => void;
  selectedClienteId?: string | null;
  routeToClienteLine?: [number, number][];
  overlays?: React.ReactNode;
}

// Component to update map view
function MapUpdater({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), {
        animate: true,
        duration: 0.5
      });
    }
  }, [center, zoom, map]);

  return null;
}

export function DeliveryRoutesMap({
  entregadores,
  clientes,
  percurso = [],
  selectedEntregador,
  onSelectEntregador,
  showPercurso = false,
  defaultCenter,
  onSelectCliente,
  selectedClienteId,
  routeToClienteLine = [],
  overlays,
}: DeliveryRoutesMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter || [-23.5505, -46.6333]);

  // Get the route line for the selected entregador
  const getRouteLine = () => {
    if (!selectedEntregador) return [];
    
    const entregador = entregadores.find(e => e.id === selectedEntregador);
    if (!entregador) return [];

    const clientesDoEntregador = clientes.filter(
      c => c.entregadorId === selectedEntregador && c.status !== "entregue"
    );

    if (clientesDoEntregador.length === 0) return [];

    const points: [number, number][] = [[entregador.lat, entregador.lng]];
    clientesDoEntregador.forEach(c => {
      points.push([c.lat, c.lng]);
    });

    return points;
  };

  // Get percurso line (historical path)
  const getPercursoLine = (): [number, number][] => {
    if (!showPercurso || percurso.length === 0) return [];
    return percurso.map(p => [p.lat, p.lng] as [number, number]);
  };

  const routePoints = getRouteLine();
  const percursoPoints = getPercursoLine();

  // Update center when defaultCenter prop changes
  useEffect(() => {
    if (defaultCenter) {
      setMapCenter(defaultCenter);
    }
  }, [defaultCenter]);

  // Update center when selecting an entregador
  useEffect(() => {
    if (selectedEntregador) {
      const entregador = entregadores.find(e => e.id === selectedEntregador);
      if (entregador) {
        setMapCenter([entregador.lat, entregador.lng]);
      }
    }
  }, [selectedEntregador, entregadores]);

  return (
    <MapContainer 
      center={mapCenter}
      zoom={13}
      style={{ height: "100%", width: "100%", minHeight: "400px" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapUpdater center={mapCenter} />

      {overlays}

      {/* Rota ativa do entregador para clientes */}
      {routePoints.length > 1 && (
        <Polyline
          positions={routePoints}
          pathOptions={{
            color: "hsl(var(--primary))",
            weight: 4,
            opacity: 0.8,
            dashArray: "10, 10"
          }}
        />
      )}

      {/* Rota entregador → cliente selecionado */}
      {routeToClienteLine.length > 1 && (
        <Polyline
          positions={routeToClienteLine}
          pathOptions={{
            color: "#2563eb",
            weight: 4,
            opacity: 0.9,
            dashArray: "8, 12"
          }}
        />
      )}

      {/* Percurso histórico */}
      {percursoPoints.length > 1 && (
        <Polyline
          positions={percursoPoints}
          pathOptions={{
            color: "hsl(var(--muted-foreground))",
            weight: 3,
            opacity: 0.6
          }}
        />
      )}

      {/* Pontos do percurso histórico */}
      {showPercurso && percurso.map((ponto, index) => (
        <Marker
          key={`percurso-${index}`}
          position={[ponto.lat, ponto.lng]}
          icon={createPercursoIcon(index)}
        >
          <Popup>
            <div className="text-center p-1">
              <p className="text-xs font-medium">Ponto {index + 1}</p>
              <p className="text-xs text-muted-foreground">{ponto.hora}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Markers dos Entregadores */}
      {entregadores.map((entregador) => {
        const gpsOff = isGpsOffline(entregador.updatedAt);
        return (
        <Marker
          key={`entregador-${entregador.id}`}
          position={[entregador.lat, entregador.lng]}
          icon={createEntregadorIcon(selectedEntregador === entregador.id, gpsOff)}
          eventHandlers={{
            click: () => {
              if (onSelectEntregador) {
                onSelectEntregador(
                  selectedEntregador === entregador.id ? null : entregador.id
                );
              }
            }
          }}
        >
          <Popup>
            <div className="min-w-[180px] p-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{entregador.nome}</p>
                  <Badge variant={entregador.status === "em_rota" ? "default" : "secondary"} className="text-[10px]">
                    {entregador.status === "em_rota" ? "Em Rota" : "Disponível"}
                  </Badge>
                </div>
              </div>
              {entregador.veiculo && (
                <p className="text-xs text-muted-foreground mb-1">
                  🚗 {entregador.veiculo}
                </p>
              )}
              {entregador.entregaAtual && (
                <p className="text-xs text-primary">
                  → {entregador.entregaAtual}
                </p>
              )}
              {gpsOff && (
                <p className="text-[10px] text-destructive font-medium mt-1">
                  ⚠ GPS Offline
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Atualizado {entregador.ultimaAtualizacao}
              </p>
              {onSelectEntregador && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={() => onSelectEntregador(entregador.id)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ver Rota
                </Button>
              )}
            </div>
          </Popup>
        </Marker>
        );
      })}

      {/* Markers dos Clientes */}
      {clientes.map((cliente) => (
        <Marker
          key={`cliente-${cliente.id}`}
          position={[cliente.lat, cliente.lng]}
          icon={createClienteIcon(cliente.status, selectedClienteId === cliente.id)}
          eventHandlers={{
            click: () => {
              if (onSelectCliente) {
                onSelectCliente(selectedClienteId === cliente.id ? null : cliente);
              }
            }
          }}
        >
          <Popup>
            <div className="min-w-[160px] p-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-warning" />
                <p className="font-semibold text-sm">{cliente.cliente}</p>
              </div>
              <p className="text-xs text-muted-foreground">{cliente.endereco}</p>
              <div className="flex items-center justify-between mt-2">
                <Badge variant={cliente.status === "pendente" ? "secondary" : cliente.status === "em_rota" ? "default" : "outline"} className="text-[10px]">
                  {cliente.status === "pendente" ? "Pendente" : cliente.status === "em_rota" ? "Em Rota" : "Confirmado"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {cliente.horarioPrevisto}
                </span>
              </div>
              {onSelectCliente && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={() => onSelectCliente(cliente)}
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Ver Entregadores Próximos
                </Button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
