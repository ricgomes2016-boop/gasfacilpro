import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { wasRecentOrderForPhone } from "@/lib/novoPedidoDedupe";

interface WhatsAppNotificationContextValue {
  unreadByConversation: Record<string, number>;
  totalUnread: number;
  selectedConversaId: string | null;
  isWidgetOpen: boolean;
  setSelectedConversaId: (id: string | null) => void;
  setWidgetOpen: (open: boolean) => void;
  markAsRead: (conversaId: string) => void;
  requestNotificationPermission: () => Promise<NotificationPermission | "unsupported">;
}

const Ctx = createContext<WhatsAppNotificationContextValue | undefined>(undefined);

const LS_PREFIX = "wa_last_read_";
const NOTIFIED_PREFIX = "wa_notified_msg_";

function playBeep() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 300);
  } catch {}
}

function supportsBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function isWindowVisibleAndFocused() {
  return document.visibilityState === "visible" && document.hasFocus();
}

export function WhatsAppNotificationProvider({ children }: { children: ReactNode }) {
  const [unreadByConversation, setUnread] = useState<Record<string, number>>({});
  const [selectedConversaId, setSelectedConversaId] = useState<string | null>(null);
  const [isWidgetOpen, setWidgetOpen] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const openRef = useRef(false);

  useEffect(() => { selectedRef.current = selectedConversaId; }, [selectedConversaId]);
  useEffect(() => { openRef.current = isWidgetOpen; }, [isWidgetOpen]);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission | "unsupported"> => {
    if (!supportsBrowserNotifications()) return "unsupported";
    if (Notification.permission !== "default") return Notification.permission;
    return Notification.requestPermission();
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string, conversaId: string) => {
    if (!supportsBrowserNotifications()) return;
    if (Notification.permission !== "granted") return;

    try {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `whatsapp-${conversaId}`,
        renotify: true,
      });

      notification.onclick = () => {
        window.focus();
        setSelectedConversaId(conversaId);
        notification.close();
      };
    } catch {}
  }, []);

  // Initial load: count unread per conversation based on localStorage timestamps
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: convs } = await supabase
        .from("ai_conversas")
        .select("id, titulo, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (!convs || cancelled) return;

      const counts: Record<string, number> = {};
      await Promise.all(
        convs.map(async (c) => {
          const lastRead = localStorage.getItem(LS_PREFIX + c.id);
          let q = supabase
            .from("ai_mensagens")
            .select("id", { count: "exact", head: true })
            .eq("conversa_id", c.id)
            .not("role", "in", "(assistant,human,system)");
          if (lastRead) q = q.gt("created_at", lastRead);
          const { count } = await q;
          if (count && count > 0) counts[c.id] = count;
        })
      );
      if (!cancelled) setUnread(counts);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime listener for new incoming messages
  useEffect(() => {
    const channel = supabase
      .channel("wa-global-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_mensagens" },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg?.id || !msg?.conversa_id) return;
          // Only count incoming (not assistant/human/operator/system)
          if (msg.role === "assistant" || msg.role === "human" || msg.role === "system") return;

          const msgId = String(msg.id);
          const convId = msg.conversa_id as string;
          const alreadyNotifiedKey = NOTIFIED_PREFIX + msgId;
          if (localStorage.getItem(alreadyNotifiedKey)) return;
          localStorage.setItem(alreadyNotifiedKey, new Date().toISOString());

          const isOpenInWidget = openRef.current && selectedRef.current === convId;
          const isVisibleAndFocused = isWindowVisibleAndFocused();

          if (isOpenInWidget && isVisibleAndFocused) {
            localStorage.setItem(LS_PREFIX + convId, new Date().toISOString());
            return;
          }

          // Increment unread count
          setUnread((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));

          // Fetch conv title for toast/browser notification
          const { data: conv } = await supabase
            .from("ai_conversas")
            .select("titulo, telefone")
            .eq("id", convId)
            .maybeSingle();

          // Dedup: se acabamos de notificar um pedido desse telefone, suprimir
          // o toast de chat para não empilhar 2 alertas pela mesma origem.
          if (wasRecentOrderForPhone(conv?.telefone)) return;

          const title = conv?.titulo || "Nova mensagem";
          const preview = String(msg.content || "").slice(0, 100);

          if (isVisibleAndFocused) {
            toast(`💬 ${title}`, {
              description: preview,
              duration: 5000,
            });
          } else {
            showBrowserNotification(`💬 ${title}`, preview || "Nova mensagem recebida", convId);
            toast(`💬 ${title}`, {
              description: preview,
              duration: 5000,
            });
          }

          playBeep();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [showBrowserNotification]);

  const markAsRead = useCallback((conversaId: string) => {
    localStorage.setItem(LS_PREFIX + conversaId, new Date().toISOString());
    setUnread((prev) => {
      if (!prev[conversaId]) return prev;
      const next = { ...prev };
      delete next[conversaId];
      return next;
    });
  }, []);

  const totalUnread = Object.values(unreadByConversation).reduce((a, b) => a + b, 0);

  return (
    <Ctx.Provider
      value={{
        unreadByConversation,
        totalUnread,
        selectedConversaId,
        isWidgetOpen,
        setSelectedConversaId,
        setWidgetOpen,
        markAsRead,
        requestNotificationPermission,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWhatsAppNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback: return no-op shape so components don't crash if used outside provider
    return {
      unreadByConversation: {} as Record<string, number>,
      totalUnread: 0,
      selectedConversaId: null,
      isWidgetOpen: false,
      setSelectedConversaId: () => {},
      setWidgetOpen: () => {},
      markAsRead: () => {},
      requestNotificationPermission: async () => "unsupported",
    } as WhatsAppNotificationContextValue;
  }
  return ctx;
}
