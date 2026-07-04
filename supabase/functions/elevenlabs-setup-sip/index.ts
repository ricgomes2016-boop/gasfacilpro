// Edge function: configura SIP Trunk GoTo + Agente Bia na ElevenLabs via API
// Roda sob demanda. Idempotente: detecta phone number existente e atualiza.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const EL_API = "https://api.elevenlabs.io/v1/convai";

interface SetupBody {
  phone_number?: string;        // E.164, ex: "+558007007007"
  label?: string;
  termination_uri?: string;     // ex: "fortegas.sip.livekit.cloud" ou domínio do GoTo
  address?: string;             // hostname GoTo, ex: "reg.jiveip.net"
  webhook_base_url?: string;    // ex: "https://scqenurznkatvrqxqjmt.supabase.co/functions/v1"
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Fail-closed admin gate — reconfigures production telephony trunk.
  const adminSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") || "";
  const headerSecret = req.headers.get("x-admin-secret") || "";
  if (!adminSecret || !headerSecret || !safeEqual(adminSecret, headerSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }


  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const agentId = Deno.env.get("ELEVENLABS_AGENT_ID");
    const sipUser = Deno.env.get("GOTO_SIP_USER") || Deno.env.get("GOTO_SIP_USERNAME");
    const sipPass = Deno.env.get("GOTO_SIP_PASSWORD");
    const sipDomain = Deno.env.get("GOTO_SIP_DOMAIN") || "reg.jiveip.net";
    const sipProxy = Deno.env.get("GOTO_SIP_OUTBOUND_PROXY") || sipDomain;

    if (!apiKey) return json({ error: "ELEVENLABS_API_KEY missing" }, 500);
    if (!agentId) return json({ error: "ELEVENLABS_AGENT_ID missing" }, 500);
    if (!sipUser || !sipPass) return json({ error: "GOTO SIP credentials missing" }, 500);

    const body: SetupBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const phoneNumber = body.phone_number || "+551150000000"; // placeholder do 0800 — ajustar depois
    const label = body.label || "GoTo 0800 Forte Gás (ramal 1004)";
    const terminationUri = body.termination_uri || sipProxy;
    const address = body.address || sipDomain;
    const webhookBase = body.webhook_base_url ||
      `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "")}.supabase.co/functions/v1`;

    const h = { "xi-api-key": apiKey, "Content-Type": "application/json" };

    const log: any[] = [];

    // 1) Listar phone numbers existentes
    const listRes = await fetch(`${EL_API}/phone-numbers`, { headers: h });
    const listData = await listRes.json();
    log.push({ step: "list_phone_numbers", status: listRes.status, count: Array.isArray(listData) ? listData.length : 0 });

    const existing = Array.isArray(listData)
      ? listData.find((p: any) => p.phone_number === phoneNumber || p.label === label)
      : null;

    let phoneId: string | undefined = existing?.phone_number_id;

    // Se já existe mas com phone_number diferente, deleta para recriar
    if (existing && existing.phone_number !== phoneNumber) {
      const delRes = await fetch(`${EL_API}/phone-numbers/${phoneId}`, {
        method: "DELETE",
        headers: h,
      });
      log.push({ step: "delete_stale_phone_number", phoneId, status: delRes.status });
      phoneId = undefined;
    }

    if (!phoneId) {
      const createRes = await fetch(`${EL_API}/phone-numbers`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          phone_number: phoneNumber,
          label,
          provider: "sip_trunk",
          termination_uri: terminationUri,
          address,
          transport: "udp",
          media_encryption: "allowed",
          credentials: { username: sipUser, password: sipPass },
          inbound_trunk_config: { allowed_addresses: [], allowed_numbers: [] },
        }),
      });
      const createData = await createRes.json();
      log.push({ step: "create_phone_number", status: createRes.status, data: createData });
      if (!createRes.ok) return json({ error: "create_phone_number failed", log }, 500);
      phoneId = createData.phone_number_id;
    } else {
      log.push({ step: "phone_number_existing_match", phoneId });
    }

    // 3) Atribuir agente ao phone number
    const assignRes = await fetch(`${EL_API}/phone-numbers/${phoneId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ agent_id: agentId }),
    });
    log.push({ step: "assign_agent", status: assignRes.status });

    // 4) Configurar webhooks no agente (initiation + post-call)
    const initiationUrl = `${webhookBase}/elevenlabs-call-initiation`;
    const postCallUrl = `${webhookBase}/elevenlabs-call-postcall`;

    const agentPatchRes = await fetch(`${EL_API}/agents/${agentId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({
        platform_settings: {
          workspace_overrides: {
            conversation_initiation_client_data_webhook: {
              url: initiationUrl,
              request_headers: {},
            },
          },
        },
        // post-call webhooks são geralmente workspace-level; vamos retornar URL pro user setar manualmente
      }),
    });
    const agentPatchData = await agentPatchRes.json().catch(() => ({}));
    log.push({ step: "configure_initiation_webhook", status: agentPatchRes.status, data: agentPatchData });

    return json({
      ok: true,
      phone_number_id: phoneId,
      agent_id: agentId,
      webhooks: { initiation: initiationUrl, post_call: postCallUrl },
      next_steps: [
        "post-call webhook precisa ser configurado em Workspace Settings → Webhooks na ElevenLabs (não exposto via API de agente).",
        `URL post-call: ${postCallUrl}`,
        "Confirmar no painel GoTo que o ramal 1004 aceita registro/INVITE do range IP da ElevenLabs (ou usar credencial digest, já configurada).",
      ],
      log,
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
