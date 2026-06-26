import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registra push notifications nativo (FCM/APNs) via Capacitor.
 * Necessário para entregar notificações com a tela desligada ou app fechado.
 * No browser, esse hook é no-op (o Web Push em usePushSubscription cuida).
 */
export function useNativePush() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    async function register() {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { LocalNotifications } = await import("@capacitor/local-notifications");

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") return;

        await LocalNotifications.requestPermissions().catch(() => {});

        await PushNotifications.register();

        PushNotifications.addListener("registration", async (token) => {
          if (cancelled) return;
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("empresa_id")
            .eq("user_id", user.id)
            .maybeSingle();

          const unidadeId =
            (typeof localStorage !== "undefined" &&
              localStorage.getItem("selected_unidade_id")) ||
            null;

          await supabase.from("push_subscriptions").upsert(
            {
              user_id: user.id,
              empresa_id: profile?.empresa_id ?? null,
              unidade_id: unidadeId,
              provider: "fcm",
              fcm_token: token.value,
              endpoint: `fcm:${token.value}`,
              p256dh: "native",
              auth: "native",
              user_agent: `capacitor/${Capacitor.getPlatform()}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "endpoint" }
          );
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.warn("[useNativePush] registration error", err);
        });

        // Em foreground: o sistema Android não mostra a notificação automaticamente;
        // disparamos uma LocalNotification para o entregador ver mesmo dentro do app.
        PushNotifications.addListener("pushNotificationReceived", async (n) => {
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Math.floor(Math.random() * 2_147_483_000),
                  title: n.title || "Novo aviso",
                  body: n.body || "",
                  smallIcon: "ic_stat_icon",
                  sound: "default",
                  extra: n.data ?? {},
                },
              ],
            });
          } catch (e) {
            console.warn("[useNativePush] local schedule error", e);
          }
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data: any = action?.notification?.data ?? {};
          const url = data.url || (data.pedidoId ? `/entregador/entregas` : "/");
          if (typeof window !== "undefined") {
            window.location.href = url;
          }
        });
      } catch (e) {
        console.warn("[useNativePush] init falhou", e);
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, []);
}
