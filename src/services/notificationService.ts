/**
 * Serviço para gerenciar notificações nativas (Windows/Browser)
 */

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.warn("Este navegador não suporta notificações desktop");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const sendOrderNotification = async (cliente: string, valor: number) => {
  if (Notification.permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    
    (registration as any).showNotification("🛵 Novo Pedido!", {
      body: `${cliente} · R$ ${valor.toFixed(2)}`,
      icon: "/favicon.png",
      badge: "/favicon.png",
      vibrate: [200, 100, 200],
      tag: "novo-pedido", // Evita empilhar muitas notificações iguais
      renotify: true,
      data: {
        url: "/pedidos"
      }
    });
  } catch (error) {
    console.error("Erro ao disparar notificação:", error);
    
    // Fallback: tenta disparar sem o service worker se falhar
    new Notification("🛵 Novo Pedido!", {
      body: `${cliente} · R$ ${valor.toFixed(2)}`,
      icon: "/favicon.png",
    });
  }
};
