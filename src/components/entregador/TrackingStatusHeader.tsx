import { useEffect, useState, useRef } from "react";
import { MapPin, Battery, BatteryCharging, Crosshair, Signal, Loader2 } from "lucide-react";
import { GeoTrackingState } from "@/hooks/useGeoTracking";

interface Props {
  tracking: GeoTrackingState;
}

interface DeviceStatus {
  batteryLevel: number | null;
  batteryCharging: boolean;
  networkType: string | null;
}

function networkLabel(type: string | null): string {
  if (!type) return "—";
  switch (type) {
    case "4g": return "4G";
    case "3g": return "3G";
    case "2g": return "2G";
    case "slow-2g": return "2G";
    default: return "WiFi";
  }
}

export function TrackingStatusHeader({ tracking }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [device, setDevice] = useState<DeviceStatus>({
    batteryLevel: null,
    batteryCharging: false,
    networkType: null,
  });
  const lastGeocodedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (!tracking.lat || !tracking.lng) return;
    const now = Date.now();
    const last = lastGeocodedRef.current;
    if (last && now - last.time < 30_000) return;

    const run = async () => {
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
    run();
  }, [tracking.lat, tracking.lng]);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const upd = () => setDevice(prev => ({
          ...prev,
          batteryLevel: battery.level,
          batteryCharging: battery.charging,
        }));
        upd();
        battery.addEventListener('levelchange', upd);
        battery.addEventListener('chargingchange', upd);
      }).catch(() => {});
    }
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const upd = () => setDevice(prev => ({ ...prev, networkType: conn.effectiveType || null }));
      upd();
      conn.addEventListener('change', upd);
      return () => conn.removeEventListener('change', upd);
    }
  }, []);

  if (!tracking.isTracking) return null;

  const BatteryIcon = device.batteryCharging ? BatteryCharging : Battery;
  const acc = tracking.accuracy;
  const accLabel = acc !== null ? `${Math.round(acc)}m` : "—";

  return (
    <div className="px-4 pb-2 pt-1 text-primary-foreground/95">
      <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-2.5 py-1.5">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium truncate flex-1">
          {loadingAddress && !address ? (
            <span className="flex items-center gap-1 text-primary-foreground/70">
              <Loader2 className="h-3 w-3 animate-spin" />
              Localizando...
            </span>
          ) : (
            address || "Aguardando GPS..."
          )}
        </span>
        <div className="flex items-center gap-2.5 shrink-0 text-[11px] font-semibold">
          <span className="flex items-center gap-0.5">
            <Signal className="h-3 w-3" />
            {networkLabel(device.networkType)}
          </span>
          <span className="flex items-center gap-0.5">
            <BatteryIcon className="h-3 w-3" />
            {device.batteryLevel !== null ? `${Math.round(device.batteryLevel * 100)}%` : "—"}
          </span>
          <span className="flex items-center gap-0.5">
            <Crosshair className="h-3 w-3" />
            {accLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
