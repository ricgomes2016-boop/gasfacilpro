import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";

export async function registerWebPushSubscription() {
  try {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (!("Notification" in window) || Notification.permission !== "granted") return false;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(
          key.byteOffset,
          key.byteOffset + key.byteLength
        ) as ArrayBuffer,
      });
    }

    const json = sub.toJSON() as {
      endpoint: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    let empresaId: string | null = null;
    const isEntregadorApp =
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/entregador") ||
        window.location.hostname.startsWith("entregador."));
    let unidadeId = isEntregadorApp
      ? null
      : (typeof localStorage !== "undefined" &&
          localStorage.getItem("selected_unidade_id")) ||
        null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();
    empresaId = profile?.empresa_id ?? null;

    const { data: entregador } = await supabase
      .from("entregadores")
      .select("unidade_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if ((isEntregadorApp || !unidadeId) && entregador?.unidade_id) {
      unidadeId = entregador.unidade_id;
    }

    if (unidadeId) {
      const { data: unidade } = await supabase
        .from("unidades")
        .select("empresa_id")
        .eq("id", unidadeId)
        .maybeSingle();
      empresaId = empresaId ?? unidade?.empresa_id ?? null;
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          empresa_id: empresaId,
          unidade_id: unidadeId,
          provider: "web",
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[registerWebPushSubscription] falha:", e);
    return false;
  }
}

/**
 * Registra a inscrição Web Push do usuário atual no Supabase.
 * Roda silenciosamente — se permissão não for "granted" ou SW indisponível, apenas sai.
 */
export function usePushSubscription() {
  useEffect(() => {
    let cancelled = false;

    async function register() {
      if (!cancelled) await registerWebPushSubscription();
    }

    register();
    const onPerm = () => register();
    window.addEventListener("focus", onPerm);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onPerm);
    };
  }, []);
}
