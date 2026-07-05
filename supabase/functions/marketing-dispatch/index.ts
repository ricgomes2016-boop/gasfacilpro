import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reject SSRF-prone URLs: only https, no internal/private/loopback/metadata hosts
function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  // IPv6 loopback / any
  if (host === "::1" || host === "[::1]" || host === "0.0.0.0") return false;
  // Metadata endpoints
  if (host === "169.254.169.254" || host === "metadata.google.internal") return false;
  // IPv4 private ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 0) return false;
  }
  // Block internal-looking hostnames
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;
  return true;
}

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

    // Caller's empresa (from profile) for tenant-ownership enforcement
    const { data: prof } = await supabase
      .from("profiles").select("empresa_id").eq("user_id", user.id).maybeSingle();
    const callerEmpresaId = prof?.empresa_id ?? null;

    const body = await req.json();
    const { action, content, phone, imageUrl, webhookUrl, unidadeId } = body;

    // === WhatsApp via Z-API or UaZapi ===
    if (action === "whatsapp") {
      if (!phone || !content) throw new Error("Telefone e conteúdo são obrigatórios");
      if (!unidadeId) throw new Error("unidadeId é obrigatório");

      // Enforce tenant ownership of the unidade
      const { data: uni } = await supabase
        .from("unidades").select("empresa_id").eq("id", unidadeId).maybeSingle();
      if (!uni?.empresa_id || !callerEmpresaId || uni.empresa_id !== callerEmpresaId) {
        return new Response(JSON.stringify({ error: "Acesso negado a esta unidade" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load WhatsApp credentials strictly for the caller's unidade
      const { data: config } = await supabase
        .from("integracoes_whatsapp")
        .select("instance_id, token, security_token, provedor")
        .eq("unidade_id", unidadeId)
        .eq("ativo", true)
        .maybeSingle();

      if (!config?.instance_id || !config?.token) {
        return new Response(JSON.stringify({
          error: "WhatsApp não configurado para esta unidade. Configure em Configurações › WhatsApp.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const instanceId = config.instance_id;
      const zapToken = config.token;
      const securityToken = config.security_token;
      const provedor = config.provedor || "zapi";

      const cleanPhone = phone.replace(/\D/g, "");

      if (provedor === "uazapi") {
        const url = `https://free.uazapi.com/send/text`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": zapToken,
          },
          body: JSON.stringify({ number: cleanPhone, text: content }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Erro UaZapi: ${resp.status} - ${errText}`);
        }

        if (imageUrl) {
          const imgUrl = `https://free.uazapi.com/send/image`;
          await fetch(imgUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": zapToken,
            },
            body: JSON.stringify({ number: cleanPhone, image: imageUrl }),
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
          const disconnected = /disconnected|not connected|enqueue message is disabled/i.test(errText);
          if (disconnected) {
            return new Response(JSON.stringify({
              ok: false,
              channel: "whatsapp",
              reason: "whatsapp_disconnected",
              message: "WhatsApp desconectado. Reconecte a instância em Configurações › WhatsApp para enviar campanhas.",
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
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
      if (!isSafeWebhookUrl(webhookUrl)) {
        return new Response(JSON.stringify({
          error: "URL de webhook inválida. Use apenas HTTPS para hosts públicos (sem endereços internos/privados).",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

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
        redirect: "manual",
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
