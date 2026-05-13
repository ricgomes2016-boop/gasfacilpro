import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  let createdRowId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "Sem header Authorization. Faça login novamente." }, 200);
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json(
        { ok: false, error: `Sessão inválida: ${userErr?.message || "usuário não encontrado"}` },
        200,
      );
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      unidade_id,
      to,
      message,
      use_template,
      template_name,
      template_lang,
    } = body || {};

    if (!unidade_id || !to) {
      return json({ ok: false, error: "unidade_id e to são obrigatórios" }, 200);
    }
    if (!use_template && !message) {
      return json({ ok: false, error: "Informe a mensagem ou ative o modo template" }, 200);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.empresa_id) {
      return json({ ok: false, error: "Usuário sem empresa associada" }, 200);
    }

    const { data: unidade } = await admin
      .from("unidades")
      .select("id, empresa_id")
      .eq("id", unidade_id)
      .maybeSingle();
    if (!unidade || unidade.empresa_id !== profile.empresa_id) {
      return json({ ok: false, error: "Unidade inválida para esta empresa" }, 200);
    }

    const { data: integ } = await admin
      .from("integracoes_whatsapp")
      .select("meta_phone_number_id, meta_access_token, provedor")
      .eq("unidade_id", unidade_id)
      .maybeSingle();

    if (!integ?.meta_phone_number_id || !integ?.meta_access_token) {
      return json(
        { ok: false, error: "Credenciais Meta não configuradas para esta unidade" },
        200,
      );
    }

    const normalized = String(to).replace(/\D/g, "");
    if (normalized.length < 10) {
      return json({ ok: false, error: "Número inválido" }, 200);
    }

    const previewMsg = use_template
      ? `[template:${template_name || "hello_world"}]`
      : message;

    const { data: row, error: insertErr } = await admin
      .from("whatsapp_test_envios")
      .insert({
        unidade_id,
        empresa_id: profile.empresa_id,
        user_id: userId,
        to_number: normalized,
        message: previewMsg,
        status: "sending",
      })
      .select()
      .single();
    if (insertErr) {
      return json({ ok: false, error: `Falha ao registrar envio: ${insertErr.message}` }, 200);
    }
    createdRowId = row.id;

    const url = `https://graph.facebook.com/v21.0/${integ.meta_phone_number_id}/messages`;

    const payload = use_template
      ? {
          messaging_product: "whatsapp",
          to: normalized,
          type: "template",
          template: {
            name: template_name || "hello_world",
            language: { code: template_lang || "en_US" },
          },
        }
      : {
          messaging_product: "whatsapp",
          to: normalized,
          type: "text",
          text: { body: message },
        };

    const metaResp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integ.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const metaJson = await metaResp.json().catch(() => ({}));

    if (!metaResp.ok) {
      const err = metaJson?.error || {};
      const errMsg =
        err.error_user_msg ||
        err.message ||
        `HTTP ${metaResp.status}`;
      const fullErr =
        `${errMsg}` +
        (err.code ? ` (code ${err.code}` + (err.error_subcode ? `/${err.error_subcode}` : "") + ")" : "");

      await admin
        .from("whatsapp_test_envios")
        .update({
          status: "failed",
          error: fullErr,
          status_history: [
            { status: "failed", at: new Date().toISOString(), detail: err },
          ],
        })
        .eq("id", row.id);

      return json({ ok: false, error: fullErr, meta: err, id: row.id }, 200);
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
    const errMsg = (e as Error).message || String(e);
    console.error("meta-test-send fatal:", errMsg);
    if (createdRowId) {
      await admin
        .from("whatsapp_test_envios")
        .update({ status: "failed", error: `Erro interno: ${errMsg}` })
        .eq("id", createdRowId);
    }
    return json({ ok: false, error: `Erro interno: ${errMsg}` }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
