import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";

interface NotificationToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function NotificationToggle({ className, showLabel = false }: NotificationToggleProps) {
  const { permission, isSupported, requestPermission } = useNotifications();

  if (!isSupported || Capacitor.isNativePlatform()) {
    return null;
  }

  const getIcon = () => {
    if (permission === "granted") return BellRing;
    if (permission === "denied") return BellOff;
    return Bell;
  };

  const Icon = getIcon();

  const getLabel = () => {
    if (permission === "granted") return "Notificações ativas";
    if (permission === "denied") return "Notificações bloqueadas";
    return "Ativar notificações";
  };

  return (
    <Button
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={requestPermission}
      disabled={permission === "denied"}
      className={cn(
        permission === "granted" && "text-success",
        permission === "denied" && "text-muted-foreground",
        className
      )}
    >
      <Icon className={cn("h-5 w-5", showLabel && "mr-2")} />
      {showLabel && <span>{getLabel()}</span>}
    </Button>
  );
}
