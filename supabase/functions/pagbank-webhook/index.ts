// PagBank webhook receiver — atualiza contas_receber pagas
// Requer header `x-pagbank-token` correspondendo ao secret PAGBANK_WEBHOOK_TOKEN
// configurado no painel do PagBank. Fail-closed: sem token válido, 401.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-authenticity-token, x-pagbank-token",
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Fail-closed auth
  const expected = Deno.env.get("PAGBANK_WEBHOOK_TOKEN") || "";
  const provided =
    req.headers.get("x-pagbank-token") ||
    req.headers.get("x-authenticity-token") ||
    "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    console.warn("pagbank-webhook: missing/invalid token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const evt = await req.json();
    const orderIdRaw = evt?.id || evt?.charges?.[0]?.id;
    const status = (evt?.charges?.[0]?.status || evt?.status || "").toUpperCase();

    console.log("pagbank-webhook:", { orderIdRaw, status });

    // Sanitize orderId: allow only safe chars to prevent ilike wildcard abuse
    const orderId = typeof orderIdRaw === "string"
      ? orderIdRaw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64)
      : "";

    if (status === "PAID" && orderId) {
      await supabase
        .from("contas_receber")
        .update({ status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10) })
        .or(`asaas_charge_id.eq.${orderId},observacoes.ilike.%${orderId}%`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("pagbank-webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
