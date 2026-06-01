import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  markOrderNotified,
  wasOrderNotified,
  isPushPrefEnabled,
} from "@/lib/novoPedidoDedupe";

/**
 * Listener único e centralizado para INSERT em `pedidos`.
 * Emite no máximo UMA notificação por pedido (desktop + toast condicional).
 *
 * Regras:
 *  - canal_venda = 'telefone_ia'  → silenciado (CallerIdPopup já mostra)
 *  - demais canais (whatsapp, pdv, app, etc) → desktop push + toast (se aba visível)
 *
 * Deve ser montado UMA única vez (em App.tsx) abaixo do AuthProvider.
 */
export function useNovoPedidoNotifier() {
  useEffect(() => {
    // Solicita permissão silenciosamente uma vez (sem assustar o usuário com modal).
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      // Não chamamos requestPermission aqui — exige gesto do usuário em Safari/Chrome.
      // O banner em MainLayout cuida disso.
    }

    const channel = supabase
      .channel("novo-pedido-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        async (payload) => {
          const p = payload.new as any;
          if (!p?.id || wasOrderNotified(p.id)) return;

          const canal = String(p.canal_venda || "").toLowerCase();
          // Telefone_ia é tratado pelo CallerIdPopup — apenas marcar como notificado
          // para que o WhatsAppNotificationContext não duplique mensagens da mesma origem.
          markOrderNotified(p.id, p.telefone_entrega || p.cliente_telefone || null);

          if (canal === "telefone_ia") return;
          if (!isPushPrefEnabled()) return;

          const cliente = p.cliente_nome || "Cliente";
          const valor = Number(p.valor_total || 0);
          const formaPgto = p.forma_pagamento
            ? ` · ${String(p.forma_pagamento).replace(/_/g, " ")}`
            : "";
          const titulo = "🛵 Novo Pedido!";
          const corpo = `${cliente} · R$ ${valor.toFixed(2)}${formaPgto}`;

          // Toast (sonner) apenas se aba visível, evita stack invisível
          if (typeof document !== "undefined" && document.visibilityState === "visible") {
            toast(titulo, { description: corpo, duration: 5000 });
          }

          // Notificação nativa via Service Worker — funciona com janela minimizada
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification(titulo, {
                  body: corpo,
                  icon: "/favicon.png",
                  badge: "/favicon.png",
                  tag: `novo-pedido-${p.id}`,
                  renotify: true,
                  requireInteraction: true,
                  data: { url: "/vendas/pedidos", pedidoId: p.id },
                  vibrate: [300, 100, 300],
                } as NotificationOptions);
              } else {
                const n = new Notification(titulo, {
                  body: corpo,
                  icon: "/favicon.png",
                  tag: `novo-pedido-${p.id}`,
                });
                n.onclick = () => {
                  window.focus();
                  n.close();
                  window.location.href = "/vendas/pedidos";
                };
              }
            } catch (e) {
              console.warn("[useNovoPedidoNotifier] falha ao exibir notificação:", e);
            }
          }

          // Som suave (uma única vez)
          try {
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
