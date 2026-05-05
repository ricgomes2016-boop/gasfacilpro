// Edge Function: elevenlabs-import-sip-trunk
// One-shot administrativa — importa o número 0800 na ElevenLabs como SIP Trunk usando credenciais GoTo.
// Padrão do projeto: sempre retorna 200 OK com flags { ok: boolean, ... }, nunca 500.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional admin guard
    const adminSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
    const headerSecret = req.headers.get("x-admin-secret");
    if (adminSecret && headerSecret && headerSecret !== adminSecret) {
      return json({ ok: false, error: "Invalid admin secret" }, 200);
    }

    // Parse optional body overrides
    let body: Record<string, unknown> = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch {
      body = {};
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    const GOTO_SIP_USER = Deno.env.get("GOTO_SIP_USER");
    const GOTO_SIP_PASSWORD = Deno.env.get("GOTO_SIP_PASSWORD");
    const GOTO_SIP_DOMAIN = Deno.env.get("GOTO_SIP_DOMAIN") || "reg.jiveip.net";
    const GOTO_SIP_OUTBOUND_PROXY = Deno.env.get("GOTO_SIP_OUTBOUND_PROXY");

    const missing: string[] = [];
    if (!ELEVENLABS_API_KEY) missing.push("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_AGENT_ID) missing.push("ELEVENLABS_AGENT_ID");
    if (!GOTO_SIP_USER) missing.push("GOTO_SIP_USER");
    if (!GOTO_SIP_PASSWORD) missing.push("GOTO_SIP_PASSWORD");
    if (missing.length > 0) {
      return json({ ok: false, error: `Missing secrets: ${missing.join(", ")}` }, 200);
    }

    const phoneNumber = (body.phone_number as string) || "+5508005900492";
    const label = (body.label as string) || "Forte Gás 0800 (GoTo Trunk 1004)";
    const transport = ((body.transport as string) || "udp").toLowerCase();
    const address = (body.address as string) || GOTO_SIP_DOMAIN;
    const agentId = (body.agent_id as string) || ELEVENLABS_AGENT_ID!;

    const payload: Record<string, unknown> = {
      provider: "sip_trunk",
      phone_number: phoneNumber,
      label,
      transport,
      address,
      username: GOTO_SIP_USER,
      password: GOTO_SIP_PASSWORD,
      agent_id: agentId,
    };

    if (GOTO_SIP_OUTBOUND_PROXY) {
      payload.outbound_proxy = GOTO_SIP_OUTBOUND_PROXY;
    }

    console.log("[elevenlabs-import-sip-trunk] Submitting", {
      phoneNumber,
      address,
      transport,
      username: GOTO_SIP_USER,
      hasProxy: !!GOTO_SIP_OUTBOUND_PROXY,
      agentId,
    });

    const url = "https://api.elevenlabs.io/v1/convai/phone-numbers/create";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }

    console.log("[elevenlabs-import-sip-trunk] Response", resp.status, rawText);

    if (!resp.ok) {
      return json({
        ok: false,
        http_status: resp.status,
        error: typeof parsed === "object" ? parsed : String(parsed),
        sent_payload: { ...payload, password: "***" },
      }, 200);
    }

    const phoneNumberId =
      (parsed as { phone_number_id?: string; id?: string })?.phone_number_id ??
      (parsed as { id?: string })?.id ?? null;

    return json({
      ok: true,
      phone_number_id: phoneNumberId,
      response: parsed,
      sent_payload: { ...payload, password: "***" },
    }, 200);
  } catch (err) {
    console.error("[elevenlabs-import-sip-trunk] Unhandled error", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 200);
  }
});
