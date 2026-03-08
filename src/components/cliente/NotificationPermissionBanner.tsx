import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeliveryNotifications } from "@/hooks/useDeliveryNotifications";

export function NotificationPermissionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { requestPermission, isSupported } = useDeliveryNotifications({
    onPermissionChange: setPermission,
  });

  useEffect(() => {
    if (!isSupported) return;
    
    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    
    // Show banner only if permission hasn't been decided yet
    if (currentPermission === "default") {
      const dismissed = localStorage.getItem("notification-banner-dismissed");
      if (!dismissed) {
        setShowBanner(true);
      }
    }
  }, [isSupported]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("notification-banner-dismissed", "true");
  };

  if (!isSupported || !showBanner || permission !== "default") {
    return null;
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/20 rounded-full">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">Ative as notificações</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Receba alertas quando seu pedido estiver chegando!
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnableNotifications}>
              Ativar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import { Capacitor } from "@capacitor/core";

export function NotificationStatus() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { requestPermission, isSupported } = useDeliveryNotifications();

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  if (!isSupported) {
    // Esconder silenciosamente se for App Nativo (Capacitor) para não assustar o usuário
    if (Capacitor.isNativePlatform()) return null;
    
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3 w-3" />
        <span>Notificações não suportadas</span>
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 text-xs text-primary">
        <Bell className="h-3 w-3" />
        <span>Notificações ativadas</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3 w-3" />
        <span>Notificações bloqueadas</span>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1"
      onClick={requestPermission}
    >
      <Bell className="h-3 w-3" />
      Ativar notificações
    </Button>
  );
}
