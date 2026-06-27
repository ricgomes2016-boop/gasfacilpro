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

export const sendOrderNotification = async (
  cliente: string,
  valor: number,
  formaPagamento?: string
) => {
  if (Notification.permission !== "granted") return;

  const pagamentoLabel = formaPagamento
    ? ` · ${formaPagamento.charAt(0).toUpperCase() + formaPagamento.slice(1).replace(/_/g, " ")}`
    : "";
  const body = `${cliente} · R$ ${valor.toFixed(2)}${pagamentoLabel}`;

  try {
    const registration = await navigator.serviceWorker.ready;

    (registration as any).showNotification("🛵 Novo Pedido!", {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      vibrate: [200, 100, 200],
      // Tag estável: re-emissões substituem (não empilham) a notificação anterior.
      tag: "novo-pedido",
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: { url: "/pedidos" },
      actions: [{ action: "open", title: "Abrir pedido" }],
    });
  } catch (error) {
    console.error("Erro ao disparar notificação via SW:", error);

    // Fallback: standard Notification API
    try {
      const n = new Notification("🛵 Novo Pedido!", {
        body,
        icon: "/favicon.png",
        tag: "novo-pedido",
      });
      n.onclick = () => {
        window.focus();
        n.close();
        window.location.href = "/pedidos";
      };
      setTimeout(() => n.close(), 8000);
    } catch (_) {}
  }
};
