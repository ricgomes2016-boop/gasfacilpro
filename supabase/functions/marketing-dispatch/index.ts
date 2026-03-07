import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) throw new Error("Não autorizado");

    const body = await req.json();
    const { action, content, phone, imageUrl, webhookUrl, unidadeId } = body;

    // === WhatsApp via Z-API or UaZapi ===
    if (action === "whatsapp") {
      if (!phone || !content) throw new Error("Telefone e conteúdo são obrigatórios");

      // Get WhatsApp credentials
      let instanceId: string | null = null;
      let zapToken: string | null = null;
      let securityToken: string | null = null;
      let provedor = "zapi";

      if (unidadeId) {
        const { data: config } = await supabase
          .from("integracoes_whatsapp")
          .select("instance_id, token, security_token, provedor")
          .eq("unidade_id", unidadeId)
          .eq("ativo", true)
          .maybeSingle();

        if (config) {
          instanceId = config.instance_id;
          zapToken = config.token;
          securityToken = config.security_token;
          provedor = config.provedor || "zapi";
        }
      }

      if (!instanceId) {
        const { data: configs } = await supabase
          .from("integracoes_whatsapp")
          .select("instance_id, token, security_token, provedor")
          .eq("ativo", true)
          .limit(1);

        if (configs && configs.length === 1) {
          instanceId = configs[0].instance_id;
          zapToken = configs[0].token;
          securityToken = configs[0].security_token;
          provedor = configs[0].provedor || "zapi";
        }
      }

      if (!instanceId) {
        instanceId = Deno.env.get("ZAPI_INSTANCE_ID") || null;
        zapToken = Deno.env.get("ZAPI_TOKEN") || null;
        securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN") || null;
        provedor = "zapi";
      }

      if (!instanceId || !zapToken) throw new Error("Credenciais WhatsApp não configuradas");

      const cleanPhone = phone.replace(/\D/g, "");

      if (provedor === "uazapi") {
        // UaZapi API
        const url = `https://api.uazapi.com/${instanceId}/send-text`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${zapToken}`,
          },
          body: JSON.stringify({ to: cleanPhone, text: content }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Erro UaZapi: ${resp.status} - ${errText}`);
        }

        if (imageUrl) {
          const imgUrl = `https://api.uazapi.com/${instanceId}/send-image`;
          await fetch(imgUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${zapToken}`,
            },
            body: JSON.stringify({ to: cleanPhone, image: imageUrl }),
          });
        }
      } else {
        // Z-API
        const url = `https://api.z-api.io/instances/${instanceId}/token/${zapToken}/send-text`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (securityToken) headers["Client-Token"] = securityToken;

        const resp = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: cleanPhone, message: content }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Erro Z-API: ${resp.status} - ${errText}`);
        }

        if (imageUrl) {
          const imgUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapToken}/send-image`;
          await fetch(imgUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ phone: cleanPhone, image: imageUrl }),
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, channel: "whatsapp", provedor }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Webhook (Zapier/n8n) ===
    if (action === "webhook") {
      if (!webhookUrl || !content) throw new Error("URL do webhook e conteúdo são obrigatórios");

      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageUrl: imageUrl || null,
          platform: body.platform || "general",
          timestamp: new Date().toISOString(),
          source: "gasfacil-marketing-ia",
        }),
      });

      return new Response(JSON.stringify({ ok: true, channel: "webhook", status: resp.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida: use 'whatsapp' ou 'webhook'");
  } catch (e: any) {
    console.error("marketing-dispatch error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
