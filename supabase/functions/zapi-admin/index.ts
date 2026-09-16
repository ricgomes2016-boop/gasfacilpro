import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action = "status", unidade_id } = body;
    if (!unidade_id) return json(400, { ok: false, error: "unidade_id é obrigatório" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: profile }, { data: unit }, { data: roles }] = await Promise.all([
      auth.userId
        ? supabase.from("profiles").select("empresa_id").eq("user_id", auth.userId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("unidades").select("id, empresa_id").eq("id", unidade_id).maybeSingle(),
      auth.userId
        ? supabase.from("user_roles").select("role").eq("user_id", auth.userId)
        : Promise.resolve({ data: [] }),
    ]);
    const roleNames = (roles || []).map((row: any) => row.role);
    const isSuperAdmin = roleNames.includes("super_admin");

    if (!unit || (!auth.isServiceRole && !isSuperAdmin && profile?.empresa_id !== unit.empresa_id)) {
      return json(403, { ok: false, error: "Unidade não autorizada" });
    }
    if (!auth.isServiceRole && !roleNames.some((role: string) => ["super_admin", "admin", "gestor"].includes(role))) {
      return json(403, { ok: false, error: "Sem permissão para administrar a integração" });
    }

    if (action === "save_config") {
      const instanceId = String(body.instance_id || "").trim();
      const instanceToken = String(body.instance_token || "").trim();
      const suppliedClientToken = String(body.client_token || "").trim();

      const { data: existing } = await supabase.from("integracoes_whatsapp")
        .select("id, security_token").eq("unidade_id", unidade_id).maybeSingle();
      const clientToken = suppliedClientToken || existing?.security_token || "";
      if (!instanceId || !instanceToken || !clientToken) {
        return json(400, { ok: false, error: "ID da instância, token da instância e Client-Token são obrigatórios. Se já havia integração, o Client-Token anterior é preservado automaticamente." });
      }

      const config = {
        unidade_id,
        provedor: "zapi",
        provedor_tipo: "zapi",
        instance_id: instanceId,
        instancia_nome: instanceId,
        token: instanceToken,
        instancia_token: instanceToken,
        security_token: clientToken,
        base_url: "https://api.z-api.io",
        instancia_url: "https://api.z-api.io",
        numero_telefone: String(body.numero_telefone || "").trim() || null,
        nome_bot: String(body.nome_bot || "BIA").trim() || "BIA",
        ativo: true,
        updated_at: new Date().toISOString(),
      };

      const saveResult = existing?.id
        ? await supabase.from("integracoes_whatsapp").update(config).eq("id", existing.id)
        : await supabase.from("integracoes_whatsapp").insert(config);
      if (saveResult.error) throw saveResult.error;
    }

    const { data: cfg } = await supabase.from("integracoes_whatsapp")
      .select("id, instance_id, token, security_token, ativo, status_conexao, numero_telefone")
      .eq("unidade_id", unidade_id).eq("provedor", "zapi").eq("ativo", true).maybeSingle();
    if (!cfg?.instance_id || !cfg?.token) return json(404, { ok: false, error: "Z-API não configurada para esta unidade" });

    const base = `https://api.z-api.io/instances/${cfg.instance_id}/token/${cfg.token}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.security_token) headers["Client-Token"] = cfg.security_token;
    const meResponse = await fetch(`${base}/me`, { headers });
    const me = await meResponse.json().catch(() => ({}));

    if (action === "configure_webhooks" || action === "save_config") {
      if (!cfg.security_token) return json(400, { ok: false, error: "Cadastre o Client-Token antes de configurar webhooks seguros" });
      const functionBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zapi-webhook`;
      const callback = `${functionBase}?unidade_id=${encodeURIComponent(unidade_id)}&security_token=${encodeURIComponent(cfg.security_token)}`;
      const endpoints = [
        "update-webhook-received",
        "update-webhook-delivery",
        "update-webhook-message-status",
        "update-webhook-connected",
        "update-webhook-disconnected",
      ];
      const results = await Promise.all(endpoints.map(async (endpoint) => {
        const response = await fetch(`${base}/${endpoint}`, { method: "PUT", headers, body: JSON.stringify({ value: callback }) });
        return { endpoint, ok: response.ok, status: response.status };
      }));
      const sentByMe = await fetch(`${base}/update-notify-sent-by-me`, {
        method: "PUT", headers, body: JSON.stringify({ notifySentByMe: true }),
      });
      const ok = results.every((result) => result.ok) && sentByMe.ok;
      if (ok) await supabase.from("integracoes_whatsapp").update({ status_conexao: me.connected ? "conectado" : "desconectado" }).eq("id", cfg.id);
      return json(ok ? 200 : 502, { ok, connected: !!me.connected, webhooks: results, notify_sent_by_me: sentByMe.ok });
    }

    await supabase.from("integracoes_whatsapp")
      .update({ status_conexao: me.connected ? "conectado" : "desconectado" })
      .eq("id", cfg.id);
    return json(meResponse.ok ? 200 : 502, {
      ok: meResponse.ok,
      connected: !!me.connected,
      phone: me.phone || cfg.numero_telefone || null,
      payment_status: me.paymentStatus || null,
      webhooks: {
        received: !!me.receivedCallbackUrl,
        delivery: !!me.deliveryCallbackUrl,
        message_status: !!me.messageStatusCallbackUrl,
        connected: !!me.connectedCallbackUrl,
        disconnected: !!me.disconnectedCallbackUrl,
        sent_by_me: !!me.receiveCallbackSentByMe,
      },
    });
  } catch (error) {
    console.error("zapi-admin error", error);
    return json(500, { ok: false, error: (error as Error).message });
  }
});
