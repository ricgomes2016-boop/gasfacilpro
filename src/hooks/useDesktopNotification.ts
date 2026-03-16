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
      // Only send desktop notification when tab is not visible
      if (!document.hidden) return;

      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "novo-pedido",
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          onClick?.();
        };

        // Auto-close after 15s
        setTimeout(() => notification.close(), 15000);
      } catch (e) {
        console.error("Desktop notification error:", e);
      }
    },
    [isSupported]
  );

  return { permission, isSupported, requestPermission, notify };
}
