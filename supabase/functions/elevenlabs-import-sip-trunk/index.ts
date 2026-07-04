// Edge Function: elevenlabs-import-sip-trunk
// One-shot administrativa — UPSERT do número 0800 na ElevenLabs como SIP Trunk usando credenciais GoTo.
// 1. Tenta CREATE. Se conflict (409), faz LIST + PATCH com as configs novas.
// 2. Atribui o agente Bia ao número via PATCH agent_id.
// Sempre retorna 200 OK com flags.

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

function maskPayload(p: Record<string, unknown>) {
  const masked: Record<string, unknown> = JSON.parse(JSON.stringify(p));
  const inb = masked.inbound_trunk_config as { credentials?: { password?: string } } | undefined;
  const out = masked.outbound_trunk_config as { credentials?: { password?: string } } | undefined;
  if (inb?.credentials?.password) inb.credentials.password = "***";
  if (out?.credentials?.password) out.credentials.password = "***";
  return masked;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fail-closed: reject unless secret is configured and header matches exactly.
    const adminSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") || "";
    const headerSecret = req.headers.get("x-admin-secret") || "";
    if (!adminSecret || !headerSecret || headerSecret.length !== adminSecret.length || headerSecret !== adminSecret) {
      return json({ ok: false, error: "Unauthorized" }, 401);
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
    const outboundAddress =
      (body.address as string) || GOTO_SIP_OUTBOUND_PROXY || GOTO_SIP_DOMAIN;
    const agentId = (body.agent_id as string) || ELEVENLABS_AGENT_ID!;
    const mediaEncryption = (body.media_encryption as string) || "allowed";

    const credentials = { username: GOTO_SIP_USER, password: GOTO_SIP_PASSWORD };

    const trunkConfig = {
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

    const apiHeaders = {
      "xi-api-key": ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    };

    let phoneNumberId: string | null = null;
    let createOrUpdateResp: unknown = null;

    // Step 1: Try to CREATE
    const createPayload = {
      provider: "sip_trunk",
      phone_number: phoneNumber,
      label,
      ...trunkConfig,
    };

    console.log("[elevenlabs-import-sip-trunk] Step 1: create", { phoneNumber, outboundAddress, transport });

    const createResp = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(createPayload),
    });
    const created = await safeJson(createResp);
    console.log("[elevenlabs-import-sip-trunk] Create response", createResp.status, created.text);

    if (createResp.ok) {
      phoneNumberId = (created.parsed as { phone_number_id?: string })?.phone_number_id ?? null;
      createOrUpdateResp = created.parsed;
    } else if (createResp.status === 409) {
      // Number already exists. Find it and PATCH with new config.
      console.log("[elevenlabs-import-sip-trunk] Conflict — listing existing numbers");
      const listResp = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
        method: "GET",
        headers: apiHeaders,
      });
      const listed = await safeJson(listResp);
      console.log("[elevenlabs-import-sip-trunk] List response", listResp.status, listed.text.slice(0, 800));

      if (!listResp.ok) {
        return json({ ok: false, step: "list", http_status: listResp.status, error: listed.parsed }, 200);
      }

      const items = Array.isArray(listed.parsed)
        ? (listed.parsed as Array<Record<string, unknown>>)
        : ((listed.parsed as { phone_numbers?: Array<Record<string, unknown>> })?.phone_numbers ?? []);

      const found = items.find((n) => {
        const num = (n.phone_number as string) || "";
        return num === phoneNumber || num.replace(/\D/g, "") === phoneNumber.replace(/\D/g, "");
      });

      if (!found) {
        return json({
          ok: false,
          step: "find_existing",
          error: "Number not found in list despite 409 conflict",
          all_numbers: items.map((n) => ({ id: n.phone_number_id, num: n.phone_number, label: n.label, provider: n.provider })),
        }, 200);
      }

      phoneNumberId = (found.phone_number_id as string) ?? null;
      console.log("[elevenlabs-import-sip-trunk] Found existing", { phoneNumberId, found });

      if (!phoneNumberId) {
        return json({ ok: false, step: "find_existing", error: "Found number but no phone_number_id", found }, 200);
      }

      // PATCH with new trunk config + label
      const patchPayload = { label, ...trunkConfig };
      console.log("[elevenlabs-import-sip-trunk] PATCH config", { phoneNumberId });

      const patchResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
        { method: "PATCH", headers: apiHeaders, body: JSON.stringify(patchPayload) },
      );
      const patched = await safeJson(patchResp);
      console.log("[elevenlabs-import-sip-trunk] Patch config response", patchResp.status, patched.text);

      if (!patchResp.ok) {
        return json({
          ok: false,
          step: "update_existing_config",
          phone_number_id: phoneNumberId,
          http_status: patchResp.status,
          error: patched.parsed,
          sent_payload: maskPayload(patchPayload),
        }, 200);
      }
      createOrUpdateResp = patched.parsed;
    } else {
      return json({
        ok: false,
        step: "create_phone_number",
        http_status: createResp.status,
        error: created.parsed,
        sent_payload: maskPayload(createPayload),
      }, 200);
    }

    if (!phoneNumberId) {
      return json({ ok: false, step: "resolve_phone_number_id", error: "No phone_number_id resolved", response: createOrUpdateResp }, 200);
    }

    // Step 2: Assign agent
    console.log("[elevenlabs-import-sip-trunk] Step 2: assign agent", { phoneNumberId, agentId });
    const assignResp = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
      { method: "PATCH", headers: apiHeaders, body: JSON.stringify({ agent_id: agentId }) },
    );
    const assigned = await safeJson(assignResp);
    console.log("[elevenlabs-import-sip-trunk] Assign agent response", assignResp.status, assigned.text);

    if (!assignResp.ok) {
      return json({
        ok: false,
        step: "assign_agent",
        phone_number_id: phoneNumberId,
        http_status: assignResp.status,
        error: assigned.parsed,
        note: "Phone number config updated, but agent assignment failed.",
      }, 200);
    }

    return json({
      ok: true,
      phone_number_id: phoneNumberId,
      agent_id: agentId,
      config_response: createOrUpdateResp,
      assign_response: assigned.parsed,
    }, 200);
  } catch (err) {
    console.error("[elevenlabs-import-sip-trunk] Unhandled error", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 200);
  }
});
