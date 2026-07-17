import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Wifi, WifiOff, Battery, BatteryCharging, Crosshair, Signal, Loader2 } from "lucide-react";
import { GeoTrackingState } from "@/hooks/useGeoTracking";

interface TrackingStatusCardProps {
  tracking: GeoTrackingState;
}

interface DeviceStatus {
  batteryLevel: number | null;
  batteryCharging: boolean;
  networkType: string | null;
  networkDownlink: number | null;
}

function getAccuracyLabel(accuracy: number | null): { label: string; color: string } {
  if (accuracy === null) return { label: "Sem dados", color: "text-muted-foreground" };
  if (accuracy <= 10) return { label: `${Math.round(accuracy)}m — Excelente`, color: "text-success" };
  if (accuracy <= 30) return { label: `${Math.round(accuracy)}m — Boa`, color: "text-info" };
  if (accuracy <= 100) return { label: `${Math.round(accuracy)}m — Moderada`, color: "text-warning" };
  return { label: `${Math.round(accuracy)}m — Fraca`, color: "text-destructive" };
}

function getNetworkLabel(type: string | null, downlink: number | null): { label: string; color: string } {
  if (!type) return { label: "Desconhecido", color: "text-muted-foreground" };
  const speed = downlink ? ` (${downlink}Mbps)` : "";
  switch (type) {
    case "4g": return { label: `4G Forte${speed}`, color: "text-success" };
    case "3g": return { label: `3G Moderado${speed}`, color: "text-warning" };
    case "2g": return { label: `2G Fraco${speed}`, color: "text-destructive" };
    case "slow-2g": return { label: `Muito Lento${speed}`, color: "text-destructive" };
    default: return { label: `WiFi${speed}`, color: "text-success" };
  }
}

function getBatteryColor(level: number | null): string {
  if (level === null) return "text-muted-foreground";
  if (level > 0.5) return "text-success";
  if (level > 0.2) return "text-warning";
  return "text-destructive";
}

export function TrackingStatusCard({ tracking }: TrackingStatusCardProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [device, setDevice] = useState<DeviceStatus>({
    batteryLevel: null,
    batteryCharging: false,
    networkType: null,
    networkDownlink: null,
  });
  const lastGeocodedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Reverse geocode with debounce (30s)
  useEffect(() => {
    if (!tracking.lat || !tracking.lng) return;

    const now = Date.now();
    const last = lastGeocodedRef.current;
    if (last && now - last.time < 30_000) return;

    const fetchAddress = async () => {
      setLoadingAddress(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${tracking.lat}&lon=${tracking.lng}&format=json&addressdetails=1`,
          { headers: { "Accept-Language": "pt-BR" } }
        );
        const data = await res.json();
        if (data && !data.error) {
          const addr = data.address || {};
          const parts = [
            addr.road,
            addr.house_number,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village,
          ].filter(Boolean);
          setAddress(parts.join(", ") || data.display_name?.substring(0, 60) || "Endereço não encontrado");
          lastGeocodedRef.current = { lat: tracking.lat!, lng: tracking.lng!, time: Date.now() };
        }
      } catch {
        setAddress("Erro ao obter endereço");
      } finally {
        setLoadingAddress(false);
      }
    };

    fetchAddress();
  }, [tracking.lat, tracking.lng]);

  // Battery & Network info
  useEffect(() => {
    let batteryRef: any = null;

    const updateBattery = (battery: any) => {
      setDevice(prev => ({
        ...prev,
        batteryLevel: battery.level,
        batteryCharging: battery.charging,
      }));
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        batteryRef = battery;
        updateBattery(battery);
        battery.addEventListener('levelchange', () => updateBattery(battery));
        battery.addEventListener('chargingchange', () => updateBattery(battery));
      }).catch(() => {});
    }

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const updateNetwork = () => {
        setDevice(prev => ({
          ...prev,
          networkType: conn.effectiveType || null,
          networkDownlink: conn.downlink || null,
        }));
      };
      updateNetwork();
      conn.addEventListener('change', updateNetwork);
      return () => {
        conn.removeEventListener('change', updateNetwork);
      };
    }
  }, []);

  if (!tracking.isTracking) return null;

  const accuracyInfo = getAccuracyLabel(tracking.accuracy);
  const networkInfo = getNetworkLabel(device.networkType, device.networkDownlink);
  const batteryColor = getBatteryColor(device.batteryLevel);
  const BatteryIcon = device.batteryCharging ? BatteryCharging : Battery;

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {/* Address row */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/30 border-b border-border/50">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground truncate flex-1">
            {loadingAddress ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Obtendo endereço...
              </span>
            ) : (
              address || "Aguardando localização..."
            )}
          </span>
        </div>

        {/* Status grid */}
        <div className="grid grid-cols-3 divide-x divide-border/50">
          {/* Network */}
          <div className="flex flex-col items-center gap-1.5 py-3 px-2">
            <Signal className={`h-4 w-4 ${networkInfo.color}`} />
            <span className={`text-xs font-semibold ${networkInfo.color}`}>
              {networkInfo.label.split(" ")[0]}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">Sinal</span>
          </div>

          {/* Battery */}
          <div className="flex flex-col items-center gap-1.5 py-3 px-2">
            <BatteryIcon className={`h-4 w-4 ${batteryColor}`} />
            <span className={`text-xs font-semibold ${batteryColor}`}>
              {device.batteryLevel !== null
                ? `${Math.round(device.batteryLevel * 100)}%`
                : "N/A"}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {device.batteryCharging ? "Carregando" : "Bateria"}
            </span>
          </div>

          {/* GPS Accuracy */}
          <div className="flex flex-col items-center gap-1.5 py-3 px-2">
            <Crosshair className={`h-4 w-4 ${accuracyInfo.color}`} />
            <span className={`text-xs font-semibold ${accuracyInfo.color}`}>
              {tracking.accuracy !== null ? `${Math.round(tracking.accuracy)}m` : "N/A"}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">Precisão</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
