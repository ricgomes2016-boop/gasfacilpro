import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const ANDROID_PUSH_CHANNEL_ID = "gasfacil_alerts_v3";
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

          // Resolver empresa_id/unidade_id. Para o app do entregador, a unidade do
          // cadastro do entregador tem prioridade sobre a loja selecionada no ERP.
          let empresaId: string | null = null;
          const isEntregadorApp =
            typeof window !== "undefined" && window.location.pathname.startsWith("/entregador");
          let unidadeId: string | null = isEntregadorApp
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

          const { data: ent } = await supabase
            .from("entregadores")
            .select("unidade_id")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if ((isEntregadorApp || !unidadeId) && ent?.unidade_id) {
            unidadeId = ent.unidade_id;
          }

          if (unidadeId) {
            const { data: uni } = await supabase
              .from("unidades")
              .select("empresa_id")
              .eq("id", unidadeId)
              .maybeSingle();
            empresaId = empresaId ?? uni?.empresa_id ?? null;
          }

          const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
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

          if (upsertError) {
            console.warn("[useNativePush] falha ao salvar token FCM", upsertError.message);
            return;
          }

          console.info("[useNativePush] token FCM registrado", {
            empresa_id: empresaId,
            unidade_id: unidadeId,
            platform: Capacitor.getPlatform(),
          });
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.warn("[useNativePush] registration error", err);
        });
        // Em foreground, o Android entrega o push ao WebView e nao exibe
        // notificacao do sistema. Não reemitimos som aqui para evitar que
        // notificações represadas toquem apenas quando o app for aberto.
        PushNotifications.addListener("pushNotificationReceived", (n) => {
          console.info("[useNativePush] push foreground recebido", n?.data ?? {});
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
