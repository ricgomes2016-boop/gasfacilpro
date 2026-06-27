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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pedidoId = body?.pedido_id as string | undefined;
    console.info("[send-push-novo-pedido] recebido", JSON.stringify({ pedidoId: pedidoId ?? null }));

    if (!pedidoId) {
      return new Response(
        JSON.stringify({ ok: false, error: "pedido_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pedido } = await supabase
      .from("pedidos")
      .select(
        "id, numero_sequencial, valor_total, canal_venda, cliente_nome, forma_pagamento, unidade_id"
      )
      .eq("id", pedidoId)
      .maybeSingle();

    if (!pedido) {
      console.info("[send-push-novo-pedido] pedido não encontrado", JSON.stringify({ pedidoId }));
      return new Response(
        JSON.stringify({ ok: true, skipped: "pedido não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Descobrir empresa via unidade
    let empresaId: string | null = null;
    if (pedido.unidade_id) {
      const { data: uni } = await supabase
        .from("unidades")
        .select("empresa_id")
        .eq("id", pedido.unidade_id)
        .maybeSingle();
      empresaId = uni?.empresa_id ?? null;
    }

    console.info(
      "[send-push-novo-pedido] contexto",
      JSON.stringify({ pedidoId, unidadeId: pedido.unidade_id ?? null, empresaId })
    );

    // Buscar inscrições da empresa (ou todas se sem empresa)
    let query = supabase.from("push_subscriptions").select("*");
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: subs, error: subsError } = await query;

    if (subsError) {
      console.warn(
        "[send-push-novo-pedido] erro ao buscar inscrições",
        JSON.stringify({ pedidoId, message: subsError.message })
      );
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: "erro ao buscar inscrições" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subs || subs.length === 0) {
      console.info("[send-push-novo-pedido] sem inscrições", JSON.stringify({ pedidoId, empresaId }));
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "sem inscrições" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cliente = pedido.cliente_nome || "Cliente";
    const valor = Number(pedido.valor_total || 0).toFixed(2);
    const ref =
      pedido.numero_sequencial != null
        ? String(pedido.numero_sequencial)
        : pedido.id.slice(0, 8).toUpperCase();

    const payload = JSON.stringify({
      title: "🛵 Novo Pedido!",
      body: `#${ref} · ${cliente} · R$ ${valor}`,
      url: "/vendas/pedidos",
      tag: `novo-pedido-${pedido.id}`,
      pedidoId: pedido.id,
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    const webSubs = subs.filter((s: any) => s.provider !== "fcm" && s.endpoint && s.p256dh && s.auth);
    const fcmSubs = subs.filter((s: any) => s.provider === "fcm" && s.fcm_token);

    console.info(
      "[send-push-novo-pedido] inscrições",
      JSON.stringify({ pedidoId, total: subs.length, web: webSubs.length, fcm: fcmSubs.length })
    );

    if (webSubs.length > 0) {
      const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
      const VAPID_SUBJECT =
        Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@gasfacilpro.com.br";

      if (VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        await Promise.all(
          webSubs.map(async (s: any) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 }
              );
              sent++;
            } catch (err: any) {
              const status = err?.statusCode;
              if (status === 404 || status === 410) {
                staleEndpoints.push(s.endpoint);
              } else {
                console.warn("[send-push-novo-pedido] erro web push:", status, err?.body);
              }
            }
          })
        );
      } else {
        console.warn("[send-push-novo-pedido] VAPID_PRIVATE_KEY ausente; web push ignorado");
      }
    }

    // FCM nativo — entrega com tela desligada / app fechado
    if (fcmSubs.length > 0) {
      const fcmResult = await sendFcmMessages(
        fcmSubs.map((s: any) => ({
          token: s.fcm_token,
          title: "🛵 Novo Pedido!",
          body: `#${ref} · ${cliente} · R$ ${valor}`,
          data: { url: "/vendas/pedidos", pedidoId: pedido.id, tag: `novo-pedido-${pedido.id}` },
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
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    console.info(
      "[send-push-novo-pedido] resumo",
      JSON.stringify({ pedidoId, sent, webRequested: webSubs.length, fcmRequested: fcmSubs.length, removed: staleEndpoints.length })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        diagnostics: {
          empresa_id_found: Boolean(empresaId),
          subscriptions_total: subs.length,
          web_total: webSubs.length,
          fcm_total: fcmSubs.length,
          stale_web_removed: staleEndpoints.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-push-novo-pedido] erro:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
