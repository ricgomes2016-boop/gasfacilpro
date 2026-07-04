// One-shot setup function for Vapi BYO SIP Trunk (GoTo / Forte Gás 0800)
// Call: GET https://<proj>.supabase.co/functions/v1/vapi-setup
// Returns JSON with credentialId, assistantId, phoneNumberId and step status.
//
// SECURITY: requires x-admin-secret header matching VAPI_SERVER_SECRET.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const VAPI_BASE = "https://api.vapi.ai";
const SERVER_URL = "https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vapi-webhook";
const PHONE_E164 = "+558005900492";
const VONAGE_SIP_URI = "sip:vonage-fortegas@sip.vapi.ai";

function safeEqualVs(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function vapi(path: string, init: RequestInit & { json?: any } = {}) {
  const apiKey = Deno.env.get("VAPI_API_KEY");
  if (!apiKey) throw new Error("VAPI_API_KEY missing");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(init.headers as any || {}),
  };
  const body = init.json ? JSON.stringify(init.json) : init.body;
  const res = await fetch(`${VAPI_BASE}${path}`, { ...init, headers, body });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Fail-closed admin gate — reconfigures production telephony trunk/assistant.
  const expected = Deno.env.get("VAPI_SERVER_SECRET") || "";
  const provided = req.headers.get("x-admin-secret") || "";
  if (!expected || !provided || !safeEqualVs(expected, provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result: any = { steps: {} };

  try {
    // No hardcoded fallbacks — SIP credentials MUST come from configured secrets.
    const username = Deno.env.get("GOTO_SIP_USERNAME") || Deno.env.get("GOTO_SIP_USER") || "";
    const password = Deno.env.get("GOTO_SIP_PASSWORD") || "";
    const domain = Deno.env.get("GOTO_SIP_DOMAIN") || "";
    const proxy = Deno.env.get("GOTO_SIP_OUTBOUND_PROXY") || "";
    if (!username || !password || !domain || !proxy) {
      return new Response(
        JSON.stringify({
          error:
            "Missing GoTo SIP secrets (GOTO_SIP_USERNAME/GOTO_SIP_USER, GOTO_SIP_PASSWORD, GOTO_SIP_DOMAIN, GOTO_SIP_OUTBOUND_PROXY)",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // ---------- STEP A: SIP Trunk Credential ----------
    // Look for existing credential with this name first
    const credList = await vapi("/credential", { method: "GET" });
    let credentialId: string | null = null;
    if (credList.ok && Array.isArray(credList.data)) {
      const found = credList.data.find((c: any) =>
        c.provider === "byo-sip-trunk" && c.name === "GoTo Forte Gas - Ramal 1004"
      );
      if (found) credentialId = found.id;
    }

    const credentialPayload = {
      provider: "byo-sip-trunk",
      name: "GoTo Forte Gas - Ramal 1004",
      gateways: [
        {
          ip: proxy,
          port: 5060,
          netmask: 32,
          inboundEnabled: true,
          outboundEnabled: true,
          outboundProtocol: "udp",
        },
      ],
      outboundAuthenticationPlan: {
        authUsername: username,
        authPassword: password,
        sipRegisterPlan: {
          domain,
          username,
          realm: domain,
        },
      },
    };

    if (credentialId) {
      // Vapi credentials are usually immutable; if it exists we keep it
      result.steps.credential = { action: "reused", id: credentialId };
    } else {
      const createCred = await vapi("/credential", { method: "POST", json: credentialPayload });
      result.steps.credential = { action: "created", status: createCred.status, data: createCred.data };
      if (createCred.ok && createCred.data?.id) credentialId = createCred.data.id;
    }

    // ---------- STEP B: Find assistant ----------
    const asstList = await vapi("/assistant", { method: "GET" });
    let assistantId: string | null = null;
    let assistantName: string | null = null;
    if (asstList.ok && Array.isArray(asstList.data) && asstList.data.length > 0) {
      const found = asstList.data.find((a: any) =>
        /bia.*forte/i.test(a.name || "") || /forte.*gas/i.test(a.name || "")
      ) || asstList.data[0];
      assistantId = found.id;
      assistantName = found.name;
    }
    result.steps.assistant_lookup = {
      status: asstList.status,
      assistantId,
      assistantName,
      total: Array.isArray(asstList.data) ? asstList.data.length : 0,
    };

    // ---------- STEP C: Patch assistant serverUrl ----------
    if (assistantId) {
      const patch = await vapi(`/assistant/${assistantId}`, {
        method: "PATCH",
        json: { server: { url: SERVER_URL } },
      });
      result.steps.assistant_server_url = {
        status: patch.status,
        ok: patch.ok,
        url: SERVER_URL,
        error: patch.ok ? null : patch.data,
      };
    } else {
      result.steps.assistant_server_url = { skipped: "no assistant found" };
    }

    // ---------- STEP D: Phone number (BYO SIP) ----------
    const phoneList = await vapi("/phone-number", { method: "GET" });
    let phoneNumberId: string | null = null;
    let vonageSipPhoneNumberId: string | null = null;
    if (phoneList.ok && Array.isArray(phoneList.data)) {
      const found = phoneList.data.find((p: any) =>
        p.number === PHONE_E164 || p.number === "558005900492" || p.name === "Forte Gas 0800"
      );
      if (found) phoneNumberId = found.id;

      const foundVonageSip = phoneList.data.find((p: any) =>
        p.sipUri === VONAGE_SIP_URI || p.name === "Vonage Forte Gas SIP"
      );
      if (foundVonageSip) vonageSipPhoneNumberId = foundVonageSip.id;
    }

    const phonePayload: any = {
      provider: "byo-phone-number",
      name: "Forte Gas 0800",
      number: PHONE_E164,
      numberE164CheckEnabled: false,
      credentialId,
      assistantId,
    };

    if (phoneNumberId) {
      const upd = await vapi(`/phone-number/${phoneNumberId}`, {
        method: "PATCH",
        json: { credentialId, assistantId, name: "Forte Gas 0800" },
      });
      result.steps.phone_number = { action: "updated", id: phoneNumberId, status: upd.status, data: upd.data };
    } else {
      const create = await vapi("/phone-number", { method: "POST", json: phonePayload });
      result.steps.phone_number = { action: "created", status: create.status, data: create.data };
      if (create.ok && create.data?.id) phoneNumberId = create.data.id;
    }

    // ---------- STEP E: Direct Vapi SIP URI used by Vonage NCCO connect ----------
    // Vonage calls sip:vonage-fortegas@sip.vapi.ai. Vapi must have this SIP URI
    // registered as a Vapi phone number and attached to the Bia assistant.
    const vonageSipPayload = {
      provider: "vapi",
      name: "Vonage Forte Gas SIP",
      sipUri: VONAGE_SIP_URI,
      assistantId,
      server: { url: SERVER_URL },
    };

    if (vonageSipPhoneNumberId) {
      const updSip = await vapi(`/phone-number/${vonageSipPhoneNumberId}`, {
        method: "PATCH",
        json: { assistantId, name: "Vonage Forte Gas SIP", server: { url: SERVER_URL } },
      });
      result.steps.vonage_sip_number = {
        action: "updated",
        id: vonageSipPhoneNumberId,
        status: updSip.status,
        data: updSip.data,
      };
    } else {
      const createSip = await vapi("/phone-number", { method: "POST", json: vonageSipPayload });
      result.steps.vonage_sip_number = {
        action: "created",
        status: createSip.status,
        data: createSip.data,
      };
      if (createSip.ok && createSip.data?.id) vonageSipPhoneNumberId = createSip.data.id;
    }

    result.summary = {
      credentialId,
      assistantId,
      assistantName,
      phoneNumberId,
      vonageSipPhoneNumberId,
      vonageSipUri: VONAGE_SIP_URI,
      serverUrl: SERVER_URL,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("vapi-setup error:", err);
    result.error = err.message || String(err);
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
