import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const fullBody = await req.json();
    const { action, instance_id, base_url: bodyBaseUrl, api_key: bodyApiKey } = fullBody;
    
    // Get instance config from integracoes_whatsapp if not provided in body
    let baseUrl = (bodyBaseUrl || "").replace(/\/$/, "");
    let apiKey = bodyApiKey;

    if (!baseUrl || !apiKey) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: config, error: dbError } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("instance_id", instance_id)
        .eq("provedor", "evolution")
        .maybeSingle();

      if (config) {
        if (!baseUrl) baseUrl = (config.base_url || "").replace(/\/$/, "");
        if (!apiKey) apiKey = config.token;
      }
    }

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "base_url não configurada e não fornecida no corpo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["apikey"] = apiKey;

    let url: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "qrcode":
        url = `${baseUrl}/instance/connect/${instance_id}`;
        break;
      case "status":
        url = `${baseUrl}/instance/connectionState/${instance_id}`;
        break;
      case "create":
        url = `${baseUrl}/instance/create`;
        method = "POST";
        body = JSON.stringify({ instanceName: instance_id, token: apiKey, qrcode: true });
        break;
      case "restart":
        url = `${baseUrl}/instance/restart/${instance_id}`;
        method = "PUT";
        break;
      case "logout":
        url = `${baseUrl}/instance/logout/${instance_id}`;
        method = "DELETE";
        break;
      case "webhook":
        url = `${baseUrl}/webhook/set/${instance_id}`;
        method = "POST";
        body = JSON.stringify(fullBody.body); // Repassamos o corpo que vem do frontend
        break;
      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log(`[EVOLUTION-PROXY] ${method} ${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let resp: Response;
    try {
      resp = await fetch(url, { method, headers, body, signal: controller.signal });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.error(`[EVOLUTION-PROXY] Fetch failed:`, fetchErr.message);
      return new Response(JSON.stringify({ 
        error: `Não foi possível conectar ao servidor Evolution API em ${baseUrl}. Verifique se o firewall permite conexões externas na porta 8080.`,
        details: fetchErr.message 
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);
    const data = await resp.json().catch(() => ({ ok: resp.ok }));
    console.log(`[EVOLUTION-PROXY] Response ${resp.status}:`, JSON.stringify(data).substring(0, 500));

    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[EVOLUTION-PROXY] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
