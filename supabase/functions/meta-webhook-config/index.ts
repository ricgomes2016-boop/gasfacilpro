// meta-webhook-config — devolve (e cria quando necessário) a URL de callback
// e o verify token do webhook da Meta para a unidade ativa.
// Nunca expõe access tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function gerarVerifyToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Não autorizado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const unidadeId = typeof body.unidade_id === "string" ? body.unidade_id : null;
    const criar = body.criar === true;
    if (!unidadeId) return json({ error: "unidade_id obrigatório" }, 400);

    const { data: profile } = await admin
      .from("profiles").select("empresa_id").eq("user_id", userId).maybeSingle();
    if (!profile?.empresa_id) return json({ error: "Perfil sem empresa vinculada" }, 403);

    const { data: unidade } = await admin
      .from("unidades").select("id, empresa_id").eq("id", unidadeId).maybeSingle();
    if (!unidade || unidade.empresa_id !== profile.empresa_id) {
      return json({ error: "Acesso negado a esta unidade" }, 403);
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/meta-webhook?unidade_id=${unidadeId}`;

    const { data: integ } = await admin
      .from("integracoes_whatsapp")
      .select("id, meta_verify_token")
      .eq("unidade_id", unidadeId)
      .eq("provedor", "meta")
      .maybeSingle();

    let verifyToken = integ?.meta_verify_token || null;

    if (!verifyToken && criar) {
      verifyToken = gerarVerifyToken();
      if (integ?.id) {
        const { error } = await admin
          .from("integracoes_whatsapp")
          .update({ meta_verify_token: verifyToken, updated_at: new Date().toISOString() })
          .eq("id", integ.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from("integracoes_whatsapp").insert({
          unidade_id: unidadeId,
          provedor: "meta",
          provedor_tipo: "meta",
          instance_id: `meta-${unidadeId.slice(0, 8)}`,
          token: "",
          ativo: true,
        }).select("id").single().then(async (res) => {
          if (res.error) return res;
          return await admin
            .from("integracoes_whatsapp")
            .update({ meta_verify_token: verifyToken })
            .eq("id", res.data.id);
        });
        if (error) throw new Error(error.message);
      }
    }

    return json({
      webhook_url: webhookUrl,
      verify_token: verifyToken,
      configurado: !!verifyToken,
    });
  } catch (e) {
    console.error("meta-webhook-config error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
