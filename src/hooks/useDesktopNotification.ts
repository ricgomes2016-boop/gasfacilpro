import { useState, useEffect, useCallback } from "react";

export function useDesktopNotification() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }, [isSupported]);

  const notify = useCallback(
    async (title: string, body: string, onClick?: () => void) => {
      if (!isSupported || Notification.permission !== "granted") return;

      try {
        // Primary: Service Worker notification (works when minimized)
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            icon: "/favicon.png",
            badge: "/favicon.png",
            // Tag estável: re-emissões substituem a notificação anterior.
            tag: "pedido-bina",
            renotify: true,
            vibrate: [200, 100, 200],
            data: { url: "/pedidos" },
          } as NotificationOptions);
        } else {
          // Fallback: standard Notification API
          const notification = new Notification(title, {
            body,
            icon: "/favicon.png",
            tag: "pedido-bina",
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
            onClick?.();
          };

          setTimeout(() => notification.close(), 8000);
        }

        // Complementary vibration
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch (e) {
        console.error("Desktop notification error:", e);
        // Last resort fallback
        try {
          const n = new Notification(title, { body, icon: "/favicon.png" });
          n.onclick = () => { window.focus(); n.close(); onClick?.(); };
          setTimeout(() => n.close(), 30000);
        } catch (_) {}
      }
    },
    [isSupported]
  );

  return { permission, isSupported, requestPermission, notify };
}
