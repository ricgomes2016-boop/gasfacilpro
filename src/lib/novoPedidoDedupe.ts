// Compartilhado entre o notifier de pedido e o WhatsAppNotificationContext
// para evitar que a mensagem que originou o pedido também gere toast de chat.

const notifiedOrderIds = new Set<string>();
const recentOrderPhones = new Map<string, number>(); // phone-last10 -> timestamp ms

export function markOrderNotified(orderId: string, phone?: string | null) {
  notifiedOrderIds.add(orderId);
  if (phone) {
    const last10 = String(phone).replace(/\D/g, "").slice(-10);
    if (last10) recentOrderPhones.set(last10, Date.now());
  }
}

export function wasOrderNotified(orderId: string): boolean {
  return notifiedOrderIds.has(orderId);
}

/** true se algum pedido foi notificado nesse telefone nos últimos `ms` (default 60s). */
export function wasRecentOrderForPhone(phone: string | null | undefined, ms = 60000): boolean {
  if (!phone) return false;
  const last10 = String(phone).replace(/\D/g, "").slice(-10);
  if (!last10) return false;
  const ts = recentOrderPhones.get(last10);
  if (!ts) return false;
  if (Date.now() - ts > ms) {
    recentOrderPhones.delete(last10);
    return false;
  }
  return true;
}

export const NOVO_PEDIDO_PUSH_PREF_KEY = "pref_notif_novo_pedido_push";

export function isPushPrefEnabled(): boolean {
  try {
    return localStorage.getItem(NOVO_PEDIDO_PUSH_PREF_KEY) !== "false";
  } catch {
    return true;
  }
}
