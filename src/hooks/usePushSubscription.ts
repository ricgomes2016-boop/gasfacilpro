import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";

/**
 * Registra a inscrição Web Push do usuário atual no Supabase.
 * Roda silenciosamente — se permissão não for "granted" ou SW indisponível, apenas sai.
 */
export function usePushSubscription() {
  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (Notification.permission !== "granted") return;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const reg = await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        const json = sub.toJSON() as {
          endpoint: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        // Busca empresa/unidade atual do perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const unidadeId =
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("selected_unidade_id")) ||
          null;

        await supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              empresa_id: profile?.empresa_id ?? null,
              unidade_id: unidadeId,
              endpoint: json.endpoint,
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
              user_agent:
                typeof navigator !== "undefined" ? navigator.userAgent : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "endpoint" }
          );
      } catch (e) {
        console.warn("[usePushSubscription] falha:", e);
      }
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
