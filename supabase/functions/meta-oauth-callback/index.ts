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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  const renderHtml = (title: string, message: string, ok: boolean, errorCode?: string) => `<!doctype html>
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
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'meta-oauth',ok:${ok},error:${JSON.stringify(errorCode || null)}},'*');}catch(e){}}, 100);</script>
</body></html>`;

  if (errorParam) {
    const isPermissionError =
      errorParam === "access_denied" || errorReason === "user_denied" ||
      errorDescription?.toLowerCase().includes("permission");
    const msg = isPermissionError
      ? "O app Meta do GásFácilPro ainda está em modo desenvolvimento. Para conectar agora: 1) descubra seu Facebook ID em facebook.com/settings (Informações pessoais); 2) envie esse ID ao suporte do GásFácilPro para ser adicionado como Testador; 3) aceite o convite em facebook.com/settings → Desenvolvedor; 4) volte aqui e clique em Conectar novamente."
      : `Erro retornado pela Meta: ${errorDescription || errorParam}. Confira se você é administrador da Página do Facebook e se o Instagram está como conta Profissional vinculada a ela.`;
    return new Response(renderHtml("Conexão cancelada", msg, false, errorParam), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!code || !stateRaw) {
    return new Response(renderHtml("Parâmetros inválidos", "Faltam code/state.", false), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const state = JSON.parse(atob(stateRaw));
    const nonce = state.n;
    const ts = state.ts;

    if (!nonce || !ts) throw new Error("State malformado");
    if (Date.now() - ts > 15 * 60 * 1000) throw new Error("State expirado (>15 min)");

    const META_APP_ID = Deno.env.get("META_APP_ID")!;
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validar nonce: existe, não usado, não expirado
    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("nonce", nonce)
      .maybeSingle();

    if (stateErr || !stateRow) throw new Error("State inválido ou desconhecido");
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

    // 3. Listar páginas
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}&fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url},picture`,
    );
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) throw new Error(`Pages fetch failed: ${JSON.stringify(pagesData)}`);

    let savedCount = 0;
    for (const page of pagesData.data ?? []) {
      await supabase.from("social_accounts").upsert(
        {
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
        },
        { onConflict: "empresa_id,plataforma,external_id" },
      );
      savedCount++;

      if (page.instagram_business_account?.id) {
        const ig = page.instagram_business_account;
        await supabase.from("social_accounts").upsert(
          {
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
          },
          { onConflict: "empresa_id,plataforma,external_id" },
        );
        savedCount++;
      }
    }

    return new Response(
      renderHtml(
        "Conectado com sucesso!",
        `${savedCount} conta(s) Meta vinculada(s). Você já pode fechar esta janela e voltar para o sistema.`,
        true,
      ),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (e) {
    console.error("meta-oauth-callback error:", e);
    return new Response(
      renderHtml("Falha na conexão", String((e as Error).message ?? e), false),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
});
