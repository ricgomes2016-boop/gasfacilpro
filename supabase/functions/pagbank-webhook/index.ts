// PagBank webhook receiver — atualiza contas_receber pagas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-authenticity-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const evt = await req.json();
    const orderId = evt?.id || evt?.charges?.[0]?.id;
    const status = (evt?.charges?.[0]?.status || evt?.status || "").toUpperCase();

    console.log("pagbank-webhook:", { orderId, status });

    if (status === "PAID" && orderId) {
      // tenta achar conta_receber referenciada
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
