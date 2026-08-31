import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const provider = body.provider === "instagram" ? "instagram" :
      body.provider === "facebook" ? "facebook" : null;
    if (!provider) {
      return new Response(JSON.stringify({ error: "Escolha Instagram ou Facebook para conectar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const unidadeId = body.unidade_id ?? null;
    if (!unidadeId) {
      return new Response(JSON.stringify({ error: "Selecione a unidade antes de conectar a Meta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: unidade }, { data: roles }] = await Promise.all([
      admin.from("unidades").select("id,nome,empresa_id").eq("id", unidadeId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (!unidade || unidade.empresa_id !== profile.empresa_id) {
      return new Response(JSON.stringify({ error: "A unidade selecionada não pertence à sua empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const podeConectar = (roles ?? []).some((r: any) => ["super_admin", "admin", "gestor"].includes(r.role));
    if (!podeConectar) {
      return new Response(JSON.stringify({ error: "Somente administrador ou gestor pode conectar redes sociais" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let returnUrl = "";
    try {
      const parsedReturn = new URL(String(body.return_url || ""));
      const allowed = parsedReturn.hostname === "app.gasfacilpro.com.br" ||
        parsedReturn.hostname.endsWith(".lovable.app") ||
        parsedReturn.hostname === "localhost";
      if (!allowed) throw new Error("origem não autorizada");
      returnUrl = parsedReturn.toString();
    } catch {
      return new Response(JSON.stringify({ error: "Endereço de retorno não autorizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mode = body.mode === "redirect" ? "redirect" : "popup";

    const appId = provider === "instagram"
      ? Deno.env.get("INSTAGRAM_APP_ID")
      : Deno.env.get("META_APP_ID");
    if (!appId) {
      return new Response(JSON.stringify({
        error: provider === "instagram"
          ? "Instagram Login ainda não está configurado no servidor"
          : "Facebook Login ainda não está configurado no servidor",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persistir nonce com service role (RLS bloqueia acesso direto)
    const nonce = crypto.randomUUID();
    const { error: nonceErr } = await admin.from("oauth_states").insert({
      nonce,
      user_id: userId,
      empresa_id: profile.empresa_id,
      unidade_id: unidade.id,
      return_url: returnUrl,
    });
    if (nonceErr) throw new Error(`Falha ao gerar state: ${nonceErr.message}`);

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    // State carrega nonce (anti-replay) + ts + modo de retorno
    const statePayload = { n: nonce, ts: Date.now(), m: mode, p: provider };
    const state = btoa(JSON.stringify(statePayload));

    const authUrl = new URL(provider === "instagram"
      ? "https://www.instagram.com/oauth/authorize"
      : "https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", provider === "instagram" ? INSTAGRAM_SCOPES : FACEBOOK_SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    if (provider === "instagram") {
      authUrl.searchParams.set("enable_fb_login", "0");
      authUrl.searchParams.set("force_authentication", "1");
    }

    console.log("meta-oauth-start", JSON.stringify({
      user_id: userId,
      empresa_id: profile.empresa_id,
      unidade_id: unidade.id,
      unidade_nome: unidade.nome,
      provider,
      mode,
      redirect_uri: redirectUri,
      return_url: returnUrl,
    }));

    return new Response(
      JSON.stringify({ url: authUrl.toString(), redirect_uri: redirectUri, mode, provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("meta-oauth-start error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
