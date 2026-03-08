import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: unknown;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      if (!Capacitor.isNativePlatform()) {
        toast({
          title: "Não suportado",
          description: "Seu navegador não suporta notificações push.",
          variant: "destructive",
        });
      }
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        toast({
          title: "Notificações ativadas!",
          description: "Você receberá alertas de novas entregas.",
        });
        return true;
      } else {
        toast({
          title: "Permissão negada",
          description: "Ative as notificações nas configurações do navegador.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão:", error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback(
    ({ title, body, icon, tag, data }: NotificationOptions) => {
      if (!isSupported || permission !== "granted") {
        // Fallback para toast se notificações não estiverem disponíveis
        toast({
          title,
          description: body,
        });
        return null;
      }

      try {
        const notification = new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          tag,
          data,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (error) {
        console.error("Erro ao enviar notificação:", error);
        toast({
          title,
          description: body,
        });
        return null;
      }
    },
    [isSupported, permission]
  );

  const notifyNewDelivery = useCallback(
    (clientName: string, address: string, pedidoId: number) => {
      sendNotification({
        title: "🚚 Nova Entrega!",
        body: `${clientName} - ${address}`,
        tag: `delivery-${pedidoId}`,
        data: { pedidoId },
      });
    },
    [sendNotification]
  );

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    notifyNewDelivery,
  };
}
