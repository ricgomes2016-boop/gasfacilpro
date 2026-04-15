import { useCallback, useEffect, useRef } from "react";

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export function useChatNotification() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const permissionGranted = useRef(false);

  useEffect(() => {
    // Pre-load audio
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.6;
    audio.preload = "auto";
    audioRef.current = audio;

    // Request notification permission
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        permissionGranted.current = true;
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          permissionGranted.current = perm === "granted";
        });
      }
    }
  }, []);

  const notify = useCallback((entregadorNome: string, mensagem: string) => {
    // Play sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }

    // Browser notification (works when tab is minimized)
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`📦 ${entregadorNome}`, {
        body: mensagem.length > 80 ? mensagem.substring(0, 80) + "…" : mensagem,
        icon: "/favicon.ico",
        tag: "chat-entregador",
      });
      // Auto-close after 5s
      setTimeout(() => notification.close(), 5000);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, []);

  return { notify };
}
