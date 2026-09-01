import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(title: string, message: string, ok: boolean, errorCode?: string, targetOrigin = "") {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}
.card{max-width:520px;background:#1e293b;padding:32px;border-radius:16px;border:1px solid #334155}
h1{margin:0 0 12px;font-size:22px;color:${ok ? "#22c55e" : "#ef4444"}}
p{margin:0 0 16px;color:#cbd5e1;line-height:1.5}
.code{font-family:monospace;background:#0f172a;padding:8px 12px;border-radius:6px;font-size:12px;color:#94a3b8;margin:8px 0}
button{background:#3b82f6;color:#fff;border:0;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;margin:4px}
</style></head><body><div class="card">
<h1>${ok ? "✅" : "⚠️"} ${escHtml(title)}</h1><p>${escHtml(message)}</p>
${errorCode ? `<div class="code">${escHtml(errorCode)}</div>` : ""}
<button onclick="window.close()">Fechar janela</button>
</div>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'meta-oauth',ok:${ok},error:${JSON.stringify(errorCode || null)}},${JSON.stringify(targetOrigin)});}catch(e){}}, 100);</script>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  // Decodifica o state o quanto antes para saber o modo de retorno
  let mode: "popup" | "redirect" = "popup";
  let provider: "instagram" | "facebook" = "facebook";
  let nonce: string | null = null;
  let ts: number | null = null;
  try {
    if (stateRaw) {
      const parsed = JSON.parse(atob(stateRaw));
      nonce = parsed.n ?? null;
      ts = parsed.ts ?? null;
      if (parsed.m === "redirect") mode = "redirect";
      if (parsed.p === "instagram") provider = "instagram";
    }
  } catch (_) {
    // state ilegível — segue como popup
  }

  console.log("meta-oauth-callback entrada", JSON.stringify({
    mode,
    has_code: !!code,
    has_state: !!stateRaw,
    error: errorParam,
    error_reason: errorReason,
    provider,
  }));

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Carrega o state para obter return_url / empresa / unidade
  let stateRow: any = null;
  if (nonce) {
    const { data } = await admin.from("oauth_states").select("*").eq("nonce", nonce).maybeSingle();
    stateRow = data ?? null;
  }

  const finish = (ok: boolean, title: string, message: string, motivo?: string) => {
    if (ok) console.log("meta-oauth-callback sucesso", JSON.stringify({ motivo, mode }));
    else console.error("meta-oauth-callback falha", JSON.stringify({ motivo, message, mode }));

    const returnUrl: string | null = stateRow?.return_url || null;
    if (mode === "redirect" && returnUrl) {
      try {
        const dest = new URL(returnUrl);
        dest.searchParams.set("meta_oauth", ok ? "ok" : "erro");
        if (motivo) dest.searchParams.set("motivo", motivo);
        dest.searchParams.set("msg", message.slice(0, 300));
        return new Response(null, { status: 302, headers: { Location: dest.toString() } });
      } catch (_) {
        // return_url inválida — cai no HTML
      }
    }
    let targetOrigin = "";
    try { targetOrigin = returnUrl ? new URL(returnUrl).origin : ""; } catch (_) {}
    return new Response(renderHtml(title, message, ok, motivo, targetOrigin), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  };

  if (errorParam) {
    const isPermissionError =
      errorParam === "access_denied" || errorReason === "user_denied" ||
      errorDescription?.toLowerCase().includes("permission");
    const msg = isPermissionError
      ? provider === "instagram"
        ? "O Instagram não autorizou a conexão. Confirme que @fortegascp é uma conta profissional, que foi adicionada como testadora do app e que o convite foi aceito nas configurações do Instagram."
        : "O app Meta do GásFácilPro ainda está em modo desenvolvimento. Adicione o Facebook administrador como testador do app, aceite o convite e tente novamente."
      : `Erro retornado pela Meta: ${errorDescription || errorParam}. Confira se você é administrador da Página do Facebook e se o Instagram está como conta Profissional vinculada a ela.`;
    return finish(false, "Conexão cancelada", msg, errorParam);
  }

  if (!code || !stateRaw) {
    return finish(false, "Parâmetros inválidos", "Faltam code/state no retorno da Meta.", "sem_code_state");
  }

  try {
    if (!nonce || !ts) throw new Error("State malformado");
    if (Date.now() - ts > 15 * 60 * 1000) throw new Error("State expirado (>15 min)");

    const META_APP_ID = Deno.env.get("META_APP_ID")!;
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
    const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID")!;
    const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET")!;
    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    const supabase = admin;
    const normalizeAssetName = (value: string) => value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    // The database has a partial unique index for external_id. PostgREST cannot
    // infer that predicate from on_conflict, so upsert(..., onConflict) fails.
    // Reuse the existing manual account (same username) or the OAuth account
    // (same external_id), then update by primary key; otherwise insert it.
    const saveSocialAccount = async (payload: Record<string, unknown>) => {
      const { data: existing, error: lookupError } = await supabase
        .from("social_accounts")
        .select("id,external_id,username")
        .eq("empresa_id", payload.empresa_id)
        .eq("unidade_id", payload.unidade_id)
        .eq("plataforma", payload.plataforma);
      if (lookupError) return lookupError;

      const externalId = String(payload.external_id || "");
      const username = normalizeAssetName(String(payload.username || ""));
      const target = (existing ?? []).find((account: any) =>
        (externalId && String(account.external_id || "") === externalId) ||
        (!account.external_id && username && normalizeAssetName(String(account.username || "")) === username)
      );

      if (target) {
        const { error } = await supabase.from("social_accounts").update(payload).eq("id", target.id);
        return error;
      }
      const { error } = await supabase.from("social_accounts").insert(payload);
      return error;
    };

    if (!stateRow) throw new Error("State inválido ou desconhecido");
    if (stateRow.used_at) throw new Error("State já utilizado (replay bloqueado)");
    if (new Date(stateRow.expires_at).getTime() < Date.now())
      throw new Error("State expirado");

    // Validar que o usuário ainda pertence à empresa
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", stateRow.user_id)
      .maybeSingle();

    if (!profile || profile.empresa_id !== stateRow.empresa_id) {
      throw new Error("Usuário não pertence mais à empresa do state");
    }

    // Marcar como usado imediatamente
    await supabase
      .from("oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("nonce", nonce);

    const { data: unidade } = await supabase
      .from("unidades")
      .select("id,nome,empresa_id")
      .eq("id", stateRow.unidade_id)
      .maybeSingle();
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id,nome")
      .eq("id", stateRow.empresa_id)
      .maybeSingle();
    if (!unidade || unidade.empresa_id !== stateRow.empresa_id || !empresa) {
      throw new Error("Empresa/unidade do vínculo não encontrada");
    }

    const nomesPermitidos = new Set([
      normalizeAssetName(empresa.nome),
      normalizeAssetName(unidade.nome),
    ].filter(Boolean));

    if (provider === "instagram") {
      if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
        throw new Error("Instagram Login não configurado no servidor");
      }

      const tokenBody = new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });
      const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });
      const shortData = await shortRes.json();
      if (!shortRes.ok) throw new Error(`Instagram token exchange failed: ${JSON.stringify(shortData)}`);

      const longUrl = new URL("https://graph.instagram.com/access_token");
      longUrl.searchParams.set("grant_type", "ig_exchange_token");
      longUrl.searchParams.set("client_secret", INSTAGRAM_APP_SECRET);
      longUrl.searchParams.set("access_token", shortData.access_token);
      const longRes = await fetch(longUrl.toString());
      const longData = await longRes.json();
      if (!longRes.ok) throw new Error(`Instagram long token failed: ${JSON.stringify(longData)}`);

      const profileUrl = new URL("https://graph.instagram.com/me");
      profileUrl.searchParams.set("fields", "user_id,username,name,profile_picture_url");
      profileUrl.searchParams.set("access_token", longData.access_token);
      const profileRes = await fetch(profileUrl.toString());
      const instagram = await profileRes.json();
      if (!profileRes.ok) throw new Error(`Instagram profile failed: ${JSON.stringify(instagram)}`);

      const { data: contasEsperadas } = await supabase
        .from("social_accounts")
        .select("username,nome_conta")
        .eq("empresa_id", stateRow.empresa_id)
        .eq("unidade_id", stateRow.unidade_id)
        .eq("plataforma", "instagram");
      for (const conta of contasEsperadas ?? []) {
        if (conta.username) nomesPermitidos.add(normalizeAssetName(conta.username));
        if (conta.nome_conta) nomesPermitidos.add(normalizeAssetName(conta.nome_conta));
      }

      const usernameNormalizado = normalizeAssetName(String(instagram.username || ""));
      if (!usernameNormalizado || !nomesPermitidos.has(usernameNormalizado)) {
        return finish(
          false,
          "Instagram empresarial não confirmado",
          `A conta @${instagram.username || "desconhecida"} não corresponde à conta cadastrada da ${unidade.nome}. Nenhuma conexão foi salva.`,
          "instagram_empresa_nao_confirmado",
        );
      }

      const externalId = String(instagram.user_id || instagram.id || shortData.user_id || "");
      if (!externalId) throw new Error("Instagram não retornou o identificador da conta profissional");
      const expiresIn = Number(longData.expires_in || 60 * 24 * 60 * 60);
      const instagramSaveError = await saveSocialAccount({
        empresa_id: stateRow.empresa_id,
        unidade_id: stateRow.unidade_id,
        plataforma: "instagram",
        nome_conta: instagram.name || instagram.username,
        username: instagram.username,
        access_token: longData.access_token,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        ig_business_id: externalId,
        external_id: externalId,
        profile_picture_url: instagram.profile_picture_url ?? null,
        conectado_via: "oauth",
        ativo: true,
        scopes: ["instagram_business_basic", "instagram_business_content_publish"],
      });
      if (instagramSaveError) throw new Error(`Falha ao salvar Instagram da empresa: ${instagramSaveError.message}`);

      return finish(
        true,
        "Instagram conectado!",
        `A conta @${instagram.username} foi vinculada à ${unidade.nome}. Nenhum Facebook pessoal foi armazenado.`,
      );
    }

    // 1. Trocar code por short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", META_APP_ID);
    tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);

    const shortToken = tokenData.access_token;

    // 2. Long-lived token (60 dias)
    const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", META_APP_ID);
    longUrl.searchParams.set("client_secret", META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", shortToken);

    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json();
    if (!longRes.ok) throw new Error(`Long token failed: ${JSON.stringify(longData)}`);

    const longToken = longData.access_token;
    const expiresIn = longData.expires_in ?? 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Listar somente Páginas administradas. A API /me/accounts não retorna
    // o perfil pessoal usado no login.
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}&fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url},picture`,
    );
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) throw new Error(`Pages fetch failed: ${JSON.stringify(pagesData)}`);

    const paginasPermitidas = (pagesData.data ?? []).filter((page: any) =>
      nomesPermitidos.has(normalizeAssetName(String(page.name || "")))
    );

    if (paginasPermitidas.length !== 1) {
      const encontradas = (pagesData.data ?? []).map((p: any) => p.name).filter(Boolean);
      const detalhe = paginasPermitidas.length > 1
        ? `Foram encontradas várias Páginas com o nome ${unidade.nome}. Remova a duplicidade ou solicite ao suporte a seleção pelo ID.`
        : `Nenhuma Página chamada ${unidade.nome} foi autorizada. Contas pessoais e outras empresas não são vinculadas. Páginas disponíveis: ${encontradas.join(", ") || "nenhuma"}.`;
      return finish(false, "Página empresarial não confirmada", detalhe, "pagina_empresa_nao_confirmada");
    }

    let savedCount = 0;
    for (const page of paginasPermitidas) {
      const facebookSaveError = await saveSocialAccount({
          empresa_id: stateRow.empresa_id,
          unidade_id: stateRow.unidade_id,
          plataforma: "facebook",
          nome_conta: page.name,
          username: page.name,
          access_token: page.access_token,
          token_expires_at: expiresAt,
          page_id: page.id,
          external_id: page.id,
          profile_picture_url: page.picture?.data?.url ?? null,
          conectado_via: "oauth",
          ativo: true,
          scopes: ["pages_manage_posts", "pages_read_engagement"],
        });
      if (facebookSaveError) throw new Error(`Falha ao salvar Página da empresa: ${facebookSaveError.message}`);
      savedCount++;

      if (page.instagram_business_account?.id) {
        const ig = page.instagram_business_account;
        const instagramSaveError = await saveSocialAccount({
            empresa_id: stateRow.empresa_id,
            unidade_id: stateRow.unidade_id,
            plataforma: "instagram",
            nome_conta: ig.username ?? page.name,
            username: ig.username,
            access_token: page.access_token,
            token_expires_at: expiresAt,
            page_id: page.id,
            ig_business_id: ig.id,
            external_id: ig.id,
            profile_picture_url: ig.profile_picture_url ?? null,
            conectado_via: "oauth",
            ativo: true,
            scopes: ["instagram_basic", "instagram_content_publish"],
          });
        if (instagramSaveError) throw new Error(`Falha ao salvar Instagram da empresa: ${instagramSaveError.message}`);
        savedCount++;
      }
    }

    if (savedCount === 0) {
      return finish(
        false,
        "Nenhuma página encontrada",
        "O login funcionou, mas nenhuma Página do Facebook foi liberada. Refaça a conexão e marque a Página da empresa na tela de permissões da Meta.",
        "sem_paginas",
      );
    }

    return finish(
      true,
      "Conectado com sucesso!",
      `${savedCount} conta(s) da ${unidade.nome} vinculada(s). Nenhum perfil pessoal foi armazenado.`,
    );
  } catch (e) {
    console.error("meta-oauth-callback error:", e);
    return finish(false, "Falha na conexão", String((e as Error).message ?? e), "erro_interno");
  }
});
