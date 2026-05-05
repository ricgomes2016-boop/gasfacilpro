// Edge Function: elevenlabs-import-sip-trunk
// One-shot administrativa — importa o número 0800 na ElevenLabs como SIP Trunk usando credenciais GoTo,
// e em seguida atribui o agente Bia ao número via PATCH.
// Padrão do projeto: sempre 200 OK com flags { ok: boolean, ... }, nunca 500.

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

async function safeJson(resp: Response) {
  const text = await resp.text();
  try {
    return { text, parsed: JSON.parse(text) as unknown };
  } catch {
    return { text, parsed: text as unknown };
  }
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
    // outbound address: prefer outbound proxy if present (more specific than reg.jiveip.net)
    const outboundAddress =
      (body.address as string) || GOTO_SIP_OUTBOUND_PROXY || GOTO_SIP_DOMAIN;
    const agentId = (body.agent_id as string) || ELEVENLABS_AGENT_ID!;
    const mediaEncryption = (body.media_encryption as string) || "allowed";

    const credentials = {
      username: GOTO_SIP_USER,
      password: GOTO_SIP_PASSWORD,
    };

    const payload: Record<string, unknown> = {
      provider: "sip_trunk",
      phone_number: phoneNumber,
      label,
      inbound_trunk_config: {
        credentials,
        media_encryption: mediaEncryption,
      },
      outbound_trunk_config: {
        address: outboundAddress,
        transport,
        media_encryption: mediaEncryption,
        credentials,
      },
    };

    console.log("[elevenlabs-import-sip-trunk] Step 1: create phone number", {
      phoneNumber,
      outboundAddress,
      transport,
      username: GOTO_SIP_USER,
      agentId,
    });

    const createResp = await fetch(
      "https://api.elevenlabs.io/v1/convai/phone-numbers",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const created = await safeJson(createResp);
    console.log(
      "[elevenlabs-import-sip-trunk] Create response",
      createResp.status,
      created.text,
    );

    if (!createResp.ok) {
      return json({
        ok: false,
        step: "create_phone_number",
        http_status: createResp.status,
        error: created.parsed,
        sent_payload: {
          ...payload,
          inbound_trunk_config: { ...payload.inbound_trunk_config as object, credentials: { username: GOTO_SIP_USER, password: "***" } },
          outbound_trunk_config: { ...payload.outbound_trunk_config as object, credentials: { username: GOTO_SIP_USER, password: "***" } },
        },
      }, 200);
    }

    const phoneNumberId =
      (created.parsed as { phone_number_id?: string })?.phone_number_id ?? null;

    if (!phoneNumberId) {
      return json({
        ok: false,
        step: "create_phone_number",
        error: "No phone_number_id returned",
        response: created.parsed,
      }, 200);
    }

    // Step 2: Assign agent to the phone number via PATCH
    console.log("[elevenlabs-import-sip-trunk] Step 2: assign agent", { phoneNumberId, agentId });

    const patchResp = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId }),
      },
    );

    const patched = await safeJson(patchResp);
    console.log(
      "[elevenlabs-import-sip-trunk] Patch response",
      patchResp.status,
      patched.text,
    );

    if (!patchResp.ok) {
      return json({
        ok: false,
        step: "assign_agent",
        phone_number_id: phoneNumberId,
        http_status: patchResp.status,
        error: patched.parsed,
        note:
          "Phone number was created but agent assignment failed. You can assign manually in the ElevenLabs dashboard.",
      }, 200);
    }

    return json({
      ok: true,
      phone_number_id: phoneNumberId,
      agent_id: agentId,
      create_response: created.parsed,
      patch_response: patched.parsed,
    }, 200);
  } catch (err) {
    console.error("[elevenlabs-import-sip-trunk] Unhandled error", err);
    return json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      200,
    );
  }
});
