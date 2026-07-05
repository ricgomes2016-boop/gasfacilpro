// meta-embedded-signup — Processa o fluxo OAuth do Embedded Signup da Meta
// Troca o código de autorização por um token de acesso de longa duração
// e retorna as credenciais do WhatsApp Business (WABA ID, Phone Number ID)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { code, unidade_id, app_id } = body;

    if (!code || !app_id || !unidade_id) {
      return json({ error: "Parâmetros obrigatórios: code, app_id, unidade_id" }, 400);
    }

    // Tenant + role guard
    if (!auth.isServiceRole) {
      const { data: prof } = await supabase
        .from("profiles").select("empresa_id").eq("user_id", auth.userId).maybeSingle();
      const { data: uni } = await supabase
        .from("unidades").select("empresa_id").eq("id", unidade_id).maybeSingle();
      if (!prof?.empresa_id || !uni?.empresa_id || prof.empresa_id !== uni.empresa_id) {
        return json({ error: "Acesso negado a esta unidade" }, 403);
      }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", auth.userId);
      const roleSet = new Set((roles ?? []).map((r: any) => r.role));
      if (!(roleSet.has("admin") || roleSet.has("gestor") || roleSet.has("super_admin"))) {
        return json({ error: "Requer perfil admin ou gestor" }, 403);
      }
    }

    // Buscar o App Secret nas variáveis de ambiente ou na tabela meta_app_config
    let appSecret = Deno.env.get("META_APP_SECRET") || "";

    if (!appSecret && unidade_id) {
      // Tentar buscar nas configurações da empresa
      const { data: appConfig } = await supabase
        .from("meta_app_config")
        .select("app_secret")
        .eq("app_id", app_id)
        .maybeSingle();

      if (appConfig?.app_secret) {
        appSecret = appConfig.app_secret;
      }
    }

    if (!appSecret) {
      return json({
        error: "META_APP_SECRET não configurado. Configure o secret no painel do Supabase ou na tabela meta_app_config.",
      }, 400);
    }

    // 1. Trocar o código pelo token de acesso de curta duração
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", app_id);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Erro ao trocar código por token:", tokenData.error);
      return json({ error: tokenData.error.message }, 400);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Trocar o token de curta duração por um de longa duração (60 dias)
    const longTokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", app_id);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();

    const accessToken = longTokenData.access_token || shortLivedToken;

    // 3. Buscar as contas WABA associadas ao token
    const wabaRes = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}&fields=id,name,whatsapp_business_accounts`
    );
    const wabaData = await wabaRes.json();

    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;
    let phoneNumber: string | null = null;

    // Extrair WABA ID e Phone Number ID
    if (wabaData.data && wabaData.data.length > 0) {
      for (const business of wabaData.data) {
        if (business.whatsapp_business_accounts?.data?.length > 0) {
          wabaId = business.whatsapp_business_accounts.data[0].id;
          break;
        }
      }
    }

    // Se não encontrou via businesses, tentar via debug_token
    if (!wabaId) {
      const debugRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${app_id}|${appSecret}`
      );
      const debugData = await debugRes.json();
      console.log("Debug token data:", JSON.stringify(debugData));
    }

    // 4. Se temos o WABA ID, buscar os números de telefone
    if (wabaId) {
      const phonesRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}&fields=id,display_phone_number,verified_name,status,quality_rating`
      );
      const phonesData = await phonesRes.json();

      if (phonesData.data && phonesData.data.length > 0) {
        phoneNumberId = phonesData.data[0].id;
        phoneNumber = phonesData.data[0].display_phone_number;
      }
    }

    // 5. Registrar o evento no log
    if (unidade_id) {
      const { data: existingConfig } = await supabase
        .from("integracoes_whatsapp")
        .select("id")
        .eq("unidade_id", unidade_id)
        .maybeSingle();

      await supabase.from("whatsapp_conexoes_log").insert({
        unidade_id,
        integracao_id: existingConfig?.id || null,
        tipo_evento: "embedded_signup",
        detalhes: {
          app_id,
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          phone_number: phoneNumber,
          token_type: longTokenData.token_type || "bearer",
        },
      }).catch(() => {}); // Não falhar se o log não funcionar
    }

    return json({
      success: true,
      access_token: accessToken,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      phone_number: phoneNumber,
      token_expires_in: longTokenData.expires_in || 5183944, // ~60 dias
    });

  } catch (error) {
    console.error("meta-embedded-signup error:", error);
    return json({ error: "Erro interno ao processar autorização" }, 500);
  }
});
