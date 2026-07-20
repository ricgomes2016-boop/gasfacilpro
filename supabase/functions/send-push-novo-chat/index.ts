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

function isStaffSubscription(sub: any): boolean {
  const scope = String(sub?.app_scope || "").toLowerCase();
  if (scope) return scope === "erp" || scope === "atendimento";

  const ua = String(sub?.user_agent || "").toLowerCase();
  if (
    ua.includes("app=entregador") ||
    ua.includes("app=cliente") ||
    ua.includes("app=vendedor") ||
    ua.includes("app=parceiro") ||
    ua.includes("app=transportadora")
  ) {
    return false;
  }

  return sub?.provider !== "fcm";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const mensagemId = body?.mensagem_id as string | undefined;
    const conversaIdInput = body?.conversa_id as string | undefined;

    if (!mensagemId && !conversaIdInput) {
      return new Response(
        JSON.stringify({ ok: false, error: "mensagem_id ou conversa_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      BACKEND_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let conversaId = conversaIdInput;
    let preview = "";

    if (mensagemId) {
      const { data: msg } = await supabase
        .from("ai_mensagens")
        .select("conversa_id, role, content")
        .eq("id", mensagemId)
        .maybeSingle();
      if (!msg) {
        return new Response(
          JSON.stringify({ ok: true, skipped: "mensagem não encontrada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg.role === "assistant" || msg.role === "human" || msg.role === "system") {
        return new Response(
          JSON.stringify({ ok: true, skipped: "mensagem de saída, ignorada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      conversaId = msg.conversa_id;
      preview = String(msg.content || "").slice(0, 120);
    }

    if (!conversaId) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "sem conversa_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: conv } = await supabase
      .from("ai_conversas")
      .select("id, titulo, telefone, empresa_id, unidade_id")
      .eq("id", conversaId)
      .maybeSingle();

    if (!conv) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "conversa não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let empresaId: string | null = conv.empresa_id ?? null;
    if (!empresaId && conv.unidade_id) {
      const { data: uni } = await supabase
        .from("unidades")
        .select("empresa_id")
        .eq("id", conv.unidade_id)
        .maybeSingle();
      empresaId = uni?.empresa_id ?? null;
    }

    let query = supabase.from("push_subscriptions").select("*");
    if (empresaId) query = query.eq("empresa_id", empresaId);
    if (conv.unidade_id) query = query.or(`unidade_id.eq.${conv.unidade_id},unidade_id.is.null`);
    const { data: subs, error: subsError } = await query;

    if (subsError) {
      console.warn(
        "[send-push-novo-chat] erro ao buscar inscrições",
        JSON.stringify({ conversaId, message: subsError.message })
      );
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: "erro ao buscar inscrições" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scopedSubs = (subs ?? []).filter(isStaffSubscription);

    if (scopedSubs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "sem inscrições" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const titulo = conv.titulo || conv.telefone || "Cliente";
    const payload = JSON.stringify({
      title: `💬 ${titulo}`,
      body: preview || "Nova mensagem no WhatsApp",
      url: "/atendimento/caixa-de-entrada",
      tag: `novo-chat-${conv.id}`,
      conversaId: conv.id,
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    const webSubs = scopedSubs.filter((s: any) => s.provider !== "fcm" && s.endpoint && s.p256dh && s.auth);
    const fcmSubs = scopedSubs.filter((s: any) => s.provider === "fcm" && s.fcm_token);

    console.info(
      "[send-push-novo-chat] inscrições",
      JSON.stringify({ conversaId, empresaId, total: scopedSubs.length, web: webSubs.length, fcm: fcmSubs.length })
    );

    if (webSubs.length > 0) {
      const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
      const VAPID_SUBJECT = normalizeVapidSubject(
        Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@gasfacilpro.com.br"
      );

      if (VAPID_PRIVATE_KEY) {
        try {
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
                  console.warn("[send-push-novo-chat] erro envio:", status, err?.body);
                }
              }
            })
          );
        } catch (err: any) {
          console.warn("[send-push-novo-chat] configuração web push inválida", err?.message ?? err);
        }
      } else {
        console.warn("[send-push-novo-chat] VAPID_PRIVATE_KEY ausente; web push ignorado");
      }
    }

    if (fcmSubs.length > 0) {
      const fcmResult = await sendFcmMessages(
        fcmSubs.map((s: any) => ({
          token: s.fcm_token,
          title: `💬 ${titulo}`,
          body: preview || "Nova mensagem no WhatsApp",
          data: { url: "/atendimento/caixa-de-entrada", conversaId: conv.id, tag: `novo-chat-${conv.id}` },
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

    return new Response(
      JSON.stringify({ ok: true, sent, removed: staleEndpoints.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-push-novo-chat] erro:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
