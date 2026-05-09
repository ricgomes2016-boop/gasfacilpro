import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const { unidade_id, to, message } = body || {};

    if (!unidade_id || !to || !message) {
      return json({ ok: false, error: "unidade_id, to e message são obrigatórios" }, 400);
    }

    // Resolve empresa
    const { data: profile } = await admin
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.empresa_id) {
      return json({ ok: false, error: "Usuário sem empresa" }, 403);
    }

    // Confirm unidade pertence à empresa
    const { data: unidade } = await admin
      .from("unidades")
      .select("id, empresa_id")
      .eq("id", unidade_id)
      .maybeSingle();
    if (!unidade || unidade.empresa_id !== profile.empresa_id) {
      return json({ ok: false, error: "Unidade inválida" }, 403);
    }

    // Buscar credenciais Meta
    const { data: integ } = await admin
      .from("integracoes_whatsapp")
      .select("meta_phone_number_id, meta_access_token, provedor")
      .eq("unidade_id", unidade_id)
      .maybeSingle();

    if (!integ?.meta_phone_number_id || !integ?.meta_access_token) {
      return json({ ok: false, error: "Credenciais Meta não configuradas para esta unidade" }, 400);
    }

    // Normalizar número (apenas dígitos, formato internacional)
    const normalized = String(to).replace(/\D/g, "");
    if (normalized.length < 10) {
      return json({ ok: false, error: "Número inválido" }, 400);
    }

    // Criar registro pendente
    const { data: row, error: insertErr } = await admin
      .from("whatsapp_test_envios")
      .insert({
        unidade_id,
        empresa_id: profile.empresa_id,
        user_id: userId,
        to_number: normalized,
        message,
        status: "sending",
      })
      .select()
      .single();
    if (insertErr) {
      return json({ ok: false, error: insertErr.message }, 500);
    }

    // Enviar via Meta Graph API
    const url = `https://graph.facebook.com/v21.0/${integ.meta_phone_number_id}/messages`;
    const metaResp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integ.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalized,
        type: "text",
        text: { body: message },
      }),
    });

    const metaJson = await metaResp.json().catch(() => ({}));

    if (!metaResp.ok) {
      const errMsg =
        metaJson?.error?.message || metaJson?.error?.error_user_msg || `HTTP ${metaResp.status}`;
      await admin
        .from("whatsapp_test_envios")
        .update({
          status: "failed",
          error: errMsg,
          status_history: [
            { status: "failed", at: new Date().toISOString(), detail: metaJson?.error || null },
          ],
        })
        .eq("id", row.id);
      return json({ ok: false, error: errMsg, meta: metaJson?.error || null, id: row.id }, 200);
    }

    const wamid = metaJson?.messages?.[0]?.id || null;
    await admin
      .from("whatsapp_test_envios")
      .update({
        status: "sent",
        wamid,
        status_history: [{ status: "sent", at: new Date().toISOString(), wamid }],
      })
      .eq("id", row.id);

    return json({ ok: true, id: row.id, wamid });
  } catch (e) {
    console.error("meta-test-send error", e);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
