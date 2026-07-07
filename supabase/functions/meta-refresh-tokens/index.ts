import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (!auth.ok) return auth.response;
  if (!auth.isServiceRole) {
    return new Response(JSON.stringify({ error: "Forbidden: service_role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const META_APP_ID = Deno.env.get("META_APP_ID")!;
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Contas OAuth ativas com token expirando em <7 dias
    const limite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: contas, error } = await supabase
      .from("social_accounts")
      .select("id, empresa_id, nome_conta, access_token, token_expires_at, plataforma, page_id")
      .eq("conectado_via", "oauth")
      .eq("ativo", true)
      .lte("token_expires_at", limite);

    if (error) throw error;

    const result = { processadas: 0, renovadas: 0, falhas: 0, detalhes: [] as any[] };

    // Para Facebook/Instagram, renovamos por page_id (token de página)
    // Agrupamos por page_id pois IG usa o mesmo token da página
    const seen = new Set<string>();
    for (const conta of contas ?? []) {
      result.processadas++;
      const key = conta.page_id || conta.id;
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const refreshUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
        refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
        refreshUrl.searchParams.set("client_id", META_APP_ID);
        refreshUrl.searchParams.set("client_secret", META_APP_SECRET);
        refreshUrl.searchParams.set("fb_exchange_token", conta.access_token);

        const r = await fetch(refreshUrl.toString());
        const data = await r.json();

        if (!r.ok || !data.access_token) {
          // Token revogado/inválido → desativar conta
          await supabase
            .from("social_accounts")
            .update({ ativo: false })
            .eq("page_id", conta.page_id);

          // Notificar admins da empresa
          const { data: admins } = await supabase
            .from("user_roles")
            .select("user_id, profiles!inner(empresa_id)")
            .in("role", ["admin", "gestor"])
            .eq("profiles.empresa_id", conta.empresa_id);

          if (admins && admins.length) {
            await supabase.from("notificacoes").insert(
              admins.map((a: any) => ({
                user_id: a.user_id,
                tipo: "integracao",
                titulo: "🔌 Reconectar Meta",
                mensagem: `A conta ${conta.nome_conta} foi desconectada. Reconecte em /marketing/redes-sociais.`,
                link: "/marketing/redes-sociais",
              })),
            );
          }

          result.falhas++;
          result.detalhes.push({ conta: conta.nome_conta, status: "desativada", erro: data });
          continue;
        }

        const novoExp = new Date(Date.now() + (data.expires_in ?? 60 * 24 * 60 * 60) * 1000).toISOString();

        // Atualiza todas as contas (FB + IG) que usam o mesmo page_id
        await supabase
          .from("social_accounts")
          .update({ access_token: data.access_token, token_expires_at: novoExp })
          .eq("page_id", conta.page_id);

        result.renovadas++;
        result.detalhes.push({ conta: conta.nome_conta, status: "renovada", novo_exp: novoExp });
      } catch (err) {
        result.falhas++;
        result.detalhes.push({ conta: conta.nome_conta, status: "erro", erro: String(err) });
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meta-refresh-tokens error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
