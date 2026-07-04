import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const fullBody = await req.json();
    const { action, instance_id } = fullBody;

    if (!instance_id || typeof instance_id !== "string") {
      return new Response(JSON.stringify({ error: "instance_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: base_url and api_key are NEVER taken from request body (SSRF risk).
    // Always derived from DB config or environment.
    let baseUrl = "";
    let apiKey = "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config } = await supabase
      .from("integracoes_whatsapp")
      .select("*")
      .eq("instance_id", instance_id)
      .eq("provedor", "evolution")
      .maybeSingle();

    // Tenant check: unless caller is service_role or super_admin, the target
    // instance MUST belong to caller's empresa. Prevents cross-tenant hijack of
    // WhatsApp connections by any authenticated user.
    if (!auth.isServiceRole) {
      // Resolve caller's empresa via profiles
      let callerEmpresaId: string | null = null;
      let callerIsSuperAdmin = false;
      if (auth.userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", auth.userId)
          .maybeSingle();
        callerEmpresaId = prof?.empresa_id ?? null;
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", auth.userId);
        callerIsSuperAdmin = !!roles?.some((r: any) => r.role === "super_admin");
      }
      if (!callerIsSuperAdmin) {
        if (!config?.empresa_id) {
          return new Response(JSON.stringify({ error: "Instância não encontrada ou sem empresa vinculada" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!callerEmpresaId || callerEmpresaId !== config.empresa_id) {
          console.warn("[EVOLUTION-PROXY] tenant mismatch", { callerEmpresaId, instanceEmpresa: config.empresa_id, instance_id });
          return new Response(JSON.stringify({ error: "Forbidden: instance does not belong to your empresa" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (config) {
      baseUrl = (config.base_url || "").replace(/\/$/, "");
      apiKey = config.token || "";
    }

    // Fallback to global secrets
    if (!baseUrl) {
      baseUrl = (Deno.env.get("EVOLUTION_BASE_URL") || "").replace(/\/$/, "");
    }
    if (!apiKey) {
      apiKey = Deno.env.get("EVOLUTION_GLOBAL_APIKEY") || "";
    }

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "base_url não configurada. Configure o secret EVOLUTION_BASE_URL." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce https/http scheme only (block file://, gopher://, etc.)
    if (!/^https?:\/\//i.test(baseUrl)) {
      return new Response(JSON.stringify({ error: "base_url inválida" }), {
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
      case "create": {
        // First try to create
        const createUrl = `${baseUrl}/instance/create`;
        console.log(`[EVOLUTION-PROXY] POST ${createUrl}`);
        const createResp = await fetch(createUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ 
            instanceName: instance_id, 
            token: apiKey, 
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          }),
        });
        const createData = await createResp.json().catch(() => ({ ok: createResp.ok }));
        console.log(`[EVOLUTION-PROXY] Create response ${createResp.status}:`, JSON.stringify(createData).substring(0, 500));

        // If instance already exists (403), just connect to get QR code
        if (createResp.status === 403 || (createData?.response?.message && JSON.stringify(createData.response.message).includes("already in use"))) {
          console.log(`[EVOLUTION-PROXY] Instance already exists, fetching QR code instead`);
          const connectUrl = `${baseUrl}/instance/connect/${instance_id}`;
          console.log(`[EVOLUTION-PROXY] GET ${connectUrl}`);
          const connectResp = await fetch(connectUrl, { method: "GET", headers });
          const connectData = await connectResp.json().catch(() => ({ ok: connectResp.ok }));
          console.log(`[EVOLUTION-PROXY] Connect response ${connectResp.status}:`, JSON.stringify(connectData).substring(0, 500));
          return new Response(JSON.stringify(connectData), {
            status: connectResp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Extract generated token
        if (createData?.hash?.apikey) {
          createData._generated_token = createData.hash.apikey;
        }
        return new Response(JSON.stringify(createData), {
          status: createResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "restart":
        url = `${baseUrl}/instance/restart/${instance_id}`;
        method = "PUT";
        break;
      case "logout":
        url = `${baseUrl}/instance/logout/${instance_id}`;
        method = "DELETE";
        break;
      case "delete":
        url = `${baseUrl}/instance/delete/${instance_id}`;
        method = "DELETE";
        break;
      case "fetchInstances":
        url = `${baseUrl}/instance/fetchInstances`;
        break;
      case "webhook":
        url = `${baseUrl}/webhook/set/${instance_id}`;
        method = "POST";
        body = JSON.stringify(fullBody.body);
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
        error: `Não foi possível conectar ao servidor Evolution API em ${baseUrl}. Verifique se o firewall permite conexões externas.`,
        details: fetchErr.message 
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);
    const data = await resp.json().catch(() => ({ ok: resp.ok }));
    console.log(`[EVOLUTION-PROXY] Response ${resp.status}:`, JSON.stringify(data).substring(0, 500));

    // For create action, extract and return the generated token
    if (action === "create" && data?.hash?.apikey) {
      data._generated_token = data.hash.apikey;
    }

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
