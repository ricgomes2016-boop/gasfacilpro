import { useCallback, useEffect, useRef } from "react";

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export function useChatNotification() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pre-load audio
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.6;
    audio.preload = "auto";
    audioRef.current = audio;

    // Proactively request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay blocked — create fresh audio on user gesture fallback
        try {
          const fallback = new Audio(NOTIFICATION_SOUND_URL);
          fallback.volume = 0.6;
          fallback.play().catch(() => {});
        } catch {}
      });
    }
  }, []);

  const notify = useCallback((senderName: string, message: string) => {
    // 1. Play sound
    playSound();

    // 2. Show notification (prefer SW for background support)
    if ("Notification" in window && Notification.permission === "granted") {
      const body = message.length > 80 ? message.substring(0, 80) + "…" : message;

      const showSWNotification = async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(`📦 ${senderName}`, {
              body,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: "chat-msg",
              renotify: true,
              requireInteraction: true,
              vibrate: [200, 100, 200],
              data: { url: "/dashboard" },
            } as NotificationOptions);
            return;
          }
        } catch {}

        // Fallback: standard Notification API
        try {
          const n = new Notification(`📦 ${senderName}`, {
            body,
            icon: "/favicon.ico",
            tag: "chat-msg",
            requireInteraction: true,
          });
          n.onclick = () => { window.focus(); n.close(); };
          setTimeout(() => n.close(), 10000);
        } catch {}
      };

      showSWNotification();
    }

    // 3. Vibrate if available
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [playSound]);

  return { notify, playSound };
}
