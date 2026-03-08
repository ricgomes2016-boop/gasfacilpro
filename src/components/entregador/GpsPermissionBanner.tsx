import { useState, useEffect } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";

export function GpsPermissionBanner() {
  const [status, setStatus] = useState<"granted" | "denied" | "prompt" | "unsupported" | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setStatus("granted");
      return;
    }

    if (sessionStorage.getItem("gpsBannerDismissed")) {
      setDismissed(true);
      return;
    }

    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setStatus(result.state as "granted" | "denied" | "prompt");
        result.onchange = () => setStatus(result.state as "granted" | "denied" | "prompt");
      }).catch(() => {
        // Fallback: try requesting position to check
        setStatus("prompt");
      });
    } else {
      setStatus("prompt");
    }
  }, []);

  const requestPermission = () => {
    navigator.geolocation.getCurrentPosition(
      () => setStatus("granted"),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("gpsBannerDismissed", "true");
  };

  if (Capacitor.isNativePlatform() || dismissed || status === "granted" || status === null) return null;

  return (
    <div className="mx-4 mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-3">
      <div className="p-2 rounded-full bg-warning/20 shrink-0">
        <MapPin className="h-5 w-5 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        {status === "unsupported" ? (
          <p className="text-sm text-foreground">
            Seu navegador não suporta GPS. Use Chrome ou Safari para rastreamento.
          </p>
        ) : status === "denied" ? (
          <>
            <p className="text-sm font-medium text-foreground">Localização bloqueada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Acesse as configurações do navegador → Permissões → Localização → Permitir para este site.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">Ative sua localização</p>
            <p className="text-xs text-muted-foreground mt-1">
              Precisamos do GPS para atualizar sua posição no mapa em tempo real.
            </p>
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={requestPermission}>
              <MapPin className="h-3 w-3 mr-1" />
              Permitir Localização
            </Button>
          </>
        )}
      </div>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
