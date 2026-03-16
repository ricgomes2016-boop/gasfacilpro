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
    (title: string, body: string, onClick?: () => void) => {
      if (!isSupported || Notification.permission !== "granted") return;

      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: `novo-pedido-${Date.now()}`,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          onClick?.();
        };

        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        // Fallback auto-close after 30s
        setTimeout(() => notification.close(), 30000);
      } catch (e) {
        console.error("Desktop notification error:", e);
      }
    },
    [isSupported]
  );

  return { permission, isSupported, requestPermission, notify };
}
