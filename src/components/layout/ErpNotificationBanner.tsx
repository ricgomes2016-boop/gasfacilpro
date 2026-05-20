import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "erp_notif_banner_dismissed";

export function ErpNotificationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setShow(true);
  }, []);

  if (!show) return null;

  const handleEnable = async () => {
    try {
      const res = await Notification.requestPermission();
      if (res !== "default") setShow(false);
    } catch {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="sticky top-0 z-40 bg-primary/10 border-b border-primary/20 px-3 py-2 flex items-center gap-3">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="text-xs sm:text-sm flex-1 min-w-0 truncate">
        Ative alertas no navegador para receber novos pedidos mesmo com o sistema minimizado.
      </p>
      <Button size="sm" onClick={handleEnable} className="h-7 text-xs">
        Ativar
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDismiss}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
