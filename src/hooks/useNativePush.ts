import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const ANDROID_PUSH_CHANNEL_ID = "gasfacil_alerts_v2";
const ANDROID_PUSH_SOUND = "gasfacil_alert.wav";

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

        // Android requer canal HIGH explícito para tocar som / acordar tela
        if (Capacitor.getPlatform() === "android") {
          try {
            await PushNotifications.createChannel({
              id: ANDROID_PUSH_CHANNEL_ID,
              name: "Notificações Importantes",
              description: "Novos pedidos, chats e alertas",
              importance: 5, // IMPORTANCE_HIGH (heads-up + som + acorda tela)
              visibility: 1,
              sound: ANDROID_PUSH_SOUND,
              vibration: true,
              lights: true,
            });
            await LocalNotifications.createChannel({
              id: ANDROID_PUSH_CHANNEL_ID,
              name: "Alertas GasFacil",
              description: "Novos pedidos, chats e alertas",
              importance: 5,
              visibility: 1,
              sound: ANDROID_PUSH_SOUND,
              vibration: true,
              lights: true,
            });
          } catch (e) {
            console.warn("[useNativePush] createChannel falhou", e);
          }
        }

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

          // Resolver empresa_id: profile → entregador → unidade selecionada
          let empresaId: string | null = null;
          const { data: profile } = await supabase
            .from("profiles")
            .select("empresa_id")
            .eq("user_id", user.id)
            .maybeSingle();
          empresaId = profile?.empresa_id ?? null;

          const unidadeId =
            (typeof localStorage !== "undefined" &&
              localStorage.getItem("selected_unidade_id")) ||
            null;

          if (!empresaId) {
            const { data: ent } = await supabase
              .from("entregadores")
              .select("unidade_id")
              .eq("user_id", user.id)
              .eq("ativo", true)
              .maybeSingle();
            if (ent?.unidade_id) {
              const { data: uni } = await supabase
                .from("unidades")
                .select("empresa_id")
                .eq("id", ent.unidade_id)
                .maybeSingle();
              empresaId = uni?.empresa_id ?? null;
            }
          }


          if (!empresaId && unidadeId) {
            const { data: uni } = await supabase
              .from("unidades")
              .select("empresa_id")
              .eq("id", unidadeId)
              .maybeSingle();
            empresaId = uni?.empresa_id ?? null;
          }

          await supabase.from("push_subscriptions").upsert(
            {
              user_id: user.id,
              empresa_id: empresaId,
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
        // Em foreground, o Android entrega o push ao WebView e nao exibe
        // notificacao do sistema. A notificacao local garante som.
        PushNotifications.addListener("pushNotificationReceived", (n) => {
          LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 2_147_483_000),
                title: n.title || "Novo aviso",
                body: n.body || "",
                channelId: ANDROID_PUSH_CHANNEL_ID,
                smallIcon: "ic_stat_icon",
                sound: ANDROID_PUSH_SOUND,
                extra: n.data ?? {},
              },
            ],
          }).catch((e) => console.warn("[useNativePush] local schedule error", e));
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
