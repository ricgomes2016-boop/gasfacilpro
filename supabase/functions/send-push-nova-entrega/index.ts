import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { sendFcmMessages } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY =
  "BJnpqpoCph8LLsYCLBBTFxpJpAbDoFODpr3diJC-14ehvnadLdHVtKer8mSv8aQjKySPGBeSc-H_p8re4zQwQco";
const BACKEND_URL = "https://scqenurznkatvrqxqjmt.supabase.co";

function normalizeVapidSubject(value: string): string {
  const subject = value.trim() || "mailto:contato@gasfacilpro.com.br";
  if (/^(mailto:|https?:\/\/)/i.test(subject)) return subject;
  return `mailto:${subject}`;
}

function isEntregadorSubscription(sub: any): boolean {
  const scope = String(sub?.app_scope || "").toLowerCase();
  if (scope) return scope === "entregador";

  const ua = String(sub?.user_agent || "").toLowerCase();
  if (ua.includes("app=entregador")) return true;
  if (
    ua.includes("app=erp") ||
    ua.includes("app=atendimento") ||
    ua.includes("app=cliente") ||
    ua.includes("app=vendedor")
  ) {
    return false;
  }

  return sub?.provider === "fcm";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Internal-only endpoint: require shared secret from DB trigger, or service_role JWT
  const expected = Deno.env.get("INTERNAL_PUSH_SECRET") ?? "";
  const provided = req.headers.get("x-internal-secret") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!isServiceRole && (!expected || provided !== expected)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pedidoId = body?.pedido_id as string | undefined;

    if (!pedidoId) {
      return new Response(JSON.stringify({ ok: false, error: "pedido_id obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      BACKEND_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .select("id, numero_sequencial, valor_total, cliente_id, entregador_id, unidade_id, endereco_entrega, status")
      .eq("id", pedidoId)
      .maybeSingle();

    if (pedidoError || !pedido?.entregador_id) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: pedidoError?.message || "pedido sem entregador" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: entregador } = await supabase
      .from("entregadores")
      .select("id, nome, user_id, unidade_id")
      .eq("id", pedido.entregador_id)
      .maybeSingle();

    if (!entregador?.user_id) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: "entregador sem usuário vinculado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cliente = "Cliente";
    if (pedido.cliente_id) {
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", pedido.cliente_id)
        .maybeSingle();
      cliente = clienteData?.nome || cliente;
    }

    const valor = Number(pedido.valor_total || 0).toFixed(2);
    const ref = pedido.numero_sequencial != null
      ? String(pedido.numero_sequencial)
      : pedido.id.slice(0, 8).toUpperCase();
    const title = "🚚 Nova entrega!";
    const notificationBody = `#${ref} · ${cliente} · R$ ${valor}`;
    const url = "/entregador/entregas";
    const tag = `nova-entrega-${pedido.id}-${pedido.entregador_id}`;

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", entregador.user_id);

    const scopedSubs = (subs ?? []).filter(isEntregadorSubscription);

    if (subsError || scopedSubs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: subsError?.message || "entregador sem inscrição push" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: notificationBody,
      url,
      tag,
      pedidoId: pedido.id,
    });

    let sent = 0;
    const staleEndpoints: string[] = [];
    const webSubs = scopedSubs.filter((s: any) => s.provider !== "fcm" && s.endpoint && s.p256dh && s.auth);
    const fcmSubs = scopedSubs.filter((s: any) => s.provider === "fcm" && s.fcm_token);

    if (webSubs.length > 0) {
      const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
      const VAPID_SUBJECT = normalizeVapidSubject(
        Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@gasfacilpro.com.br"
      );

      if (VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        await Promise.all(
          webSubs.map(async (s: any) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 4500, urgency: "high" } as any
              );
              sent++;
            } catch (err: any) {
              const status = err?.statusCode;
              if (status === 404 || status === 410) staleEndpoints.push(s.endpoint);
              else console.warn("[send-push-nova-entrega] erro web push:", status, err?.body);
            }
          })
        );
      } else {
        console.warn("[send-push-nova-entrega] VAPID_PRIVATE_KEY ausente; web push ignorado");
      }
    }

    if (fcmSubs.length > 0) {
      const fcmResult = await sendFcmMessages(
        fcmSubs.map((s: any) => ({
          token: s.fcm_token,
          title,
          body: notificationBody,
          data: { url, pedidoId: pedido.id, tag },
        }))
      );
      sent += fcmResult.sent;
      if (fcmResult.invalidTokens.length > 0) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .in("fcm_token", fcmResult.invalidTokens);
      }
    }

    if (staleEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    console.info(
      "[send-push-nova-entrega] resumo",
      JSON.stringify({ pedidoId, entregadorId: pedido.entregador_id, sent, web: webSubs.length, fcm: fcmSubs.length })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        diagnostics: {
          subscriptions_total: scopedSubs.length,
          web_total: webSubs.length,
          fcm_total: fcmSubs.length,
          stale_web_removed: staleEndpoints.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-push-nova-entrega] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
