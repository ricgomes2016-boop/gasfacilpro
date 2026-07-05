import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function publishInstagram(igId: string, token: string, imageUrl: string, caption: string) {
  // 1. Cria container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    },
  );
  const container = await containerRes.json();
  if (!containerRes.ok) throw new Error(`IG container: ${JSON.stringify(container)}`);

  // 2. Publica
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    },
  );
  const publish = await publishRes.json();
  if (!publishRes.ok) throw new Error(`IG publish: ${JSON.stringify(publish)}`);
  return publish.id;
}

async function publishFacebook(pageId: string, token: string, imageUrl: string, caption: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/photos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl, caption, access_token: token }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`FB publish: ${JSON.stringify(data)}`);
  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { social_account_id, image_url, caption } = body;

    if (!social_account_id || !caption) {
      return new Response(JSON.stringify({ error: "social_account_id e caption obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: account, error } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("id", social_account_id)
      .maybeSingle();

    if (error || !account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant guard: caller's empresa must match the social account's empresa
    if (!auth.isServiceRole) {
      const { data: prof } = await supabase
        .from("profiles").select("empresa_id").eq("user_id", auth.userId).maybeSingle();
      if (!prof?.empresa_id || !account.empresa_id || prof.empresa_id !== account.empresa_id) {
        return new Response(JSON.stringify({ error: "Acesso negado a esta conta social" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (account.conectado_via !== "oauth" || !account.access_token) {
      return new Response(JSON.stringify({ error: "Conta não está conectada via OAuth" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let externalId: string;
    if (account.plataforma === "instagram") {
      if (!image_url) throw new Error("Instagram exige imagem");
      externalId = await publishInstagram(account.ig_business_id, account.access_token, image_url, caption);
    } else if (account.plataforma === "facebook") {
      if (!image_url) throw new Error("Facebook publish atual exige imagem");
      externalId = await publishFacebook(account.page_id, account.access_token, image_url, caption);
    } else {
      throw new Error(`Plataforma não suportada: ${account.plataforma}`);
    }

    return new Response(JSON.stringify({ success: true, external_id: externalId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meta-publish-post error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
