import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { wasRecentOrderForPhone } from "@/lib/novoPedidoDedupe";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";


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

function supportsBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function isWindowVisibleAndFocused(): boolean {
  if (typeof document === "undefined") return false;
  const visible = document.visibilityState === "visible";
  let focused = true;
  try { focused = document.hasFocus(); } catch { focused = true; }
  return visible && focused;
}

async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supportsBrowserNotifications()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function showBrowserNotification(title: string, body: string, conversaId: string) {
  if (!supportsBrowserNotifications()) return;
  if (Notification.permission !== "granted") return;
  const data = { url: "/atendimento/caixa-de-entrada", conversaId };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `wa-msg-${conversaId}`,
        renotify: true,
        data,
      } as NotificationOptions);
      return;
    }
  } catch {}
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `wa-msg-${conversaId}`,
      data,
    } as NotificationOptions);
    n.onclick = () => {
      try { window.focus(); } catch {}
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("wa-open-conversa", { detail: { conversaId } }));
        }
      } catch {}
      n.close();
    };
    setTimeout(() => { try { n.close(); } catch {} }, 10000);
  } catch {}
}


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

export function WhatsAppNotificationProvider({ children }: { children: ReactNode }) {
  const [unreadByConversation, setUnread] = useState<Record<string, number>>({});
  const [selectedConversaId, setSelectedConversaId] = useState<string | null>(null);
  const [isWidgetOpen, setWidgetOpen] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const openRef = useRef(false);

  // Escopo: empresa do usuário + unidade atual (quando houver)
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id ?? null;
  const unidadeId = unidadeAtual?.id ?? null;
  const empresaRef = useRef<string | null>(null);
  const unidadeRef = useRef<string | null>(null);
  useEffect(() => { empresaRef.current = empresaId; }, [empresaId]);
  useEffect(() => { unidadeRef.current = unidadeId; }, [unidadeId]);

  useEffect(() => { selectedRef.current = selectedConversaId; }, [selectedConversaId]);
  useEffect(() => { openRef.current = isWidgetOpen; }, [isWidgetOpen]);

  // Helper: a conversa pertence ao escopo atual (mesma empresa + unidade atual ou legado sem unidade)?
  const conversaNoEscopo = useCallback((conv: { empresa_id?: string | null; unidade_id?: string | null } | null | undefined) => {
    if (!conv) return false;
    const emp = empresaRef.current;
    if (emp && conv.empresa_id && conv.empresa_id !== emp) return false;
    const uni = unidadeRef.current;
    if (uni && conv.unidade_id && conv.unidade_id !== uni) return false;
    return true;
  }, []);

  // Initial load: count unread per conversation based on localStorage timestamps
  useEffect(() => {
    if (!empresaId) { setUnread({}); return; }
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("ai_conversas")
        .select("id, titulo, updated_at, empresa_id, unidade_id")
        .eq("empresa_id", empresaId)
        .order("updated_at", { ascending: false })
        .limit(200);
      const { data: convs } = await q;
      if (!convs || cancelled) return;

      // Mesmo filtro do inbox: unidade atual OU sem unidade (legado)
      const inScope = convs.filter((c) => !unidadeId || !c.unidade_id || c.unidade_id === unidadeId);

      const counts: Record<string, number> = {};
      await Promise.all(
        inScope.map(async (c) => {
          const lastRead = localStorage.getItem(LS_PREFIX + c.id);
          let q2 = supabase
            .from("ai_mensagens")
            .select("id", { count: "exact", head: true })
            .eq("conversa_id", c.id)
            .not("role", "in", "(assistant,human,system)");
          if (lastRead) q2 = q2.gt("created_at", lastRead);
          const { count } = await q2;
          if (count && count > 0) counts[c.id] = count;
        })
      );
      if (!cancelled) setUnread(counts);
    })();
    return () => { cancelled = true; };
  }, [empresaId, unidadeId]);

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
          // Only count incoming (not assistant/human/system)
          if (msg.role === "assistant" || msg.role === "human" || msg.role === "system") return;

          const msgId = String(msg.id);
          const notifiedKey = NOTIFIED_PREFIX + msgId;
          if (localStorage.getItem(notifiedKey)) return;

          const convId = msg.conversa_id as string;

          // Valida escopo antes de incrementar/notificar
          const { data: conv } = await supabase
            .from("ai_conversas")
            .select("titulo, telefone, empresa_id, unidade_id")
            .eq("id", convId)
            .maybeSingle();
          if (!conversaNoEscopo(conv)) return;

          try { localStorage.setItem(notifiedKey, "1"); } catch {}

          const windowVisibleFocused = isWindowVisibleAndFocused();
          const isOpenInWidget = openRef.current && selectedRef.current === convId;
          if (isOpenInWidget && windowVisibleFocused) {
            localStorage.setItem(LS_PREFIX + convId, new Date().toISOString());
            return;
          }

          setUnread((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));

          if (wasRecentOrderForPhone(conv?.telefone)) return;

          const title = conv?.titulo || "Nova mensagem";
          const preview = String(msg.content || "").slice(0, 80);
          toast(`💬 ${title}`, { description: preview, duration: 5000 });
          playBeep();

          if (!windowVisibleFocused && supportsBrowserNotifications() && Notification.permission === "granted") {
            showBrowserNotification(`💬 ${title}`, preview, convId);
          }
        }

      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversaNoEscopo]);

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
    } as WhatsAppNotificationContextValue;
  }
  return ctx;
}
