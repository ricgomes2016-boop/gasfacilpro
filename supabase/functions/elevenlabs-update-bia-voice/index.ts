// Edge function: ajusta a velocidade da voz do agente Bia (ElevenLabs Conversational AI).
// GET  -> retorna config TTS atual
// POST -> { speed?: number, stability?: number, similarity_boost?: number } (default speed 0.9)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return new Response(
      JSON.stringify({ ok: false, error: "ELEVENLABS_API_KEY ou ELEVENLABS_AGENT_ID ausente." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const baseUrl = `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`;

  try {
    if (req.method === "GET") {
      const r = await fetch(baseUrl, { headers: { "xi-api-key": ELEVENLABS_API_KEY } });
      const text = await r.text();
      let json: any;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      const tts = json?.conversation_config?.tts ?? null;
      return new Response(
        JSON.stringify({ ok: r.ok, status: r.status, tts, agent_id: ELEVENLABS_AGENT_ID }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const speed = typeof body.speed === "number" ? body.speed : 0.9;
    const stability = typeof body.stability === "number" ? body.stability : undefined;
    const similarity_boost = typeof body.similarity_boost === "number" ? body.similarity_boost : undefined;

    if (speed < 0.7 || speed > 1.2) {
      return new Response(
        JSON.stringify({ ok: false, error: "speed deve estar entre 0.7 e 1.2" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const getRes = await fetch(baseUrl, { headers: { "xi-api-key": ELEVENLABS_API_KEY } });
    const current = await getRes.json();
    const currentTts = current?.conversation_config?.tts ?? {};

    const newTts: Record<string, unknown> = { ...currentTts, speed };
    if (stability !== undefined) newTts.stability = stability;
    if (similarity_boost !== undefined) newTts.similarity_boost = similarity_boost;

    // Enviar somente o subobjeto tts — reenviar conversation_config inteiro
    // dispara erro "both tools and tool_ids" no agente.
    const patchPayload = {
      conversation_config: {
        tts: newTts,
      },
    };

    const patchRes = await fetch(baseUrl, {
      method: "PATCH",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(patchPayload),
    });
    const patchText = await patchRes.text();
    let patchJson: any;
    try { patchJson = JSON.parse(patchText); } catch { patchJson = { raw: patchText }; }

    return new Response(
      JSON.stringify({
        ok: patchRes.ok,
        status: patchRes.status,
        applied: { speed, stability, similarity_boost },
        previous_tts: currentTts,
        new_tts: patchJson?.conversation_config?.tts ?? patchJson,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[elevenlabs-update-bia-voice] erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
