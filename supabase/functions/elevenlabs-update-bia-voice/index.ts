// Edge function: lê e ajusta voz (TTS), prompt e first_message do agente Bia (ElevenLabs Conversational AI).
// GET                    -> retorna config TTS atual + prompt + first_message
// POST { speed?, stability?, similarity_boost?, expressive_mode?, prompt?, first_message? }
//   - Campos omitidos não são alterados.
//   - speed default permanece 0.95 quando enviado sem valor explícito? Não — só altera se presente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Fail-closed: require ELEVENLABS_WEBHOOK_SECRET via x-admin-secret header.
  const adminSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") || "";
  const headerSecret = req.headers.get("x-admin-secret") || "";
  if (!adminSecret || !headerSecret || !safeEqual(adminSecret, headerSecret)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
  const headers = { "xi-api-key": ELEVENLABS_API_KEY };

  try {
    if (req.method === "GET") {
      const r = await fetch(baseUrl, { headers });
      const text = await r.text();
      let json: any;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      const tts = json?.conversation_config?.tts ?? null;
      const agent = json?.conversation_config?.agent ?? {};
      const promptObj = agent?.prompt ?? {};
      const prompt = promptObj?.prompt ?? "";
      const llm = promptObj?.llm ?? null;
      const temperature = promptObj?.temperature ?? null;
      const max_tokens = promptObj?.max_tokens ?? null;
      const first_message = agent?.first_message ?? "";
      const language = agent?.language ?? "pt";
      return new Response(
        JSON.stringify({
          ok: r.ok,
          status: r.status,
          tts,
          prompt,
          llm,
          temperature,
          max_tokens,
          first_message,
          language,
          agent_id: ELEVENLABS_AGENT_ID,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const speed = typeof body.speed === "number" ? body.speed : undefined;
    const stability = typeof body.stability === "number" ? body.stability : undefined;
    const similarity_boost = typeof body.similarity_boost === "number" ? body.similarity_boost : undefined;
    const expressive_mode = typeof body.expressive_mode === "boolean" ? body.expressive_mode : undefined;
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
    const first_message = typeof body.first_message === "string" ? body.first_message : undefined;
    const voice_id = typeof body.voice_id === "string" ? body.voice_id : undefined;
    const style = typeof body.style === "number" ? body.style : undefined;
    const model_id = typeof body.model_id === "string" ? body.model_id : undefined;
    const use_speaker_boost = typeof body.use_speaker_boost === "boolean" ? body.use_speaker_boost : undefined;
    const optimize_streaming_latency = typeof body.optimize_streaming_latency === "number" ? body.optimize_streaming_latency : undefined;
    const llm = typeof body.llm === "string" ? body.llm : undefined;
    const temperature = typeof body.temperature === "number" ? body.temperature : undefined;
    const max_tokens = typeof body.max_tokens === "number" ? body.max_tokens : undefined;

    if (speed !== undefined && (speed < 0.7 || speed > 1.2)) {
      return new Response(
        JSON.stringify({ ok: false, error: "speed deve estar entre 0.7 e 1.2" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar config atual para fazer merge cirúrgico
    const getRes = await fetch(baseUrl, { headers });
    const current = await getRes.json();
    const currentTts = current?.conversation_config?.tts ?? {};
    const currentAgent = current?.conversation_config?.agent ?? {};
    const currentPromptObj = currentAgent?.prompt ?? {};

    // Montar patch parcial
    const conversation_config: Record<string, any> = {};

    // TTS
    const ttsChanges: Record<string, unknown> = {};
    if (speed !== undefined) ttsChanges.speed = speed;
    if (stability !== undefined) ttsChanges.stability = stability;
    if (similarity_boost !== undefined) ttsChanges.similarity_boost = similarity_boost;
    if (expressive_mode !== undefined) ttsChanges.expressive_mode = expressive_mode;
    if (voice_id !== undefined) ttsChanges.voice_id = voice_id;
    if (style !== undefined) ttsChanges.style = style;
    if (model_id !== undefined) ttsChanges.model_id = model_id;
    if (use_speaker_boost !== undefined) ttsChanges.use_speaker_boost = use_speaker_boost;
    if (optimize_streaming_latency !== undefined) ttsChanges.optimize_streaming_latency = optimize_streaming_latency;
    if (Object.keys(ttsChanges).length > 0) {
      conversation_config.tts = { ...currentTts, ...ttsChanges };
    }

    // Agent (prompt + first_message + llm/temperature/max_tokens)
    if (prompt !== undefined || first_message !== undefined || llm !== undefined || temperature !== undefined || max_tokens !== undefined) {
      const agentPatch: Record<string, any> = {};
      const promptPatch: Record<string, any> = { ...currentPromptObj };
      // ElevenLabs rejects PATCH if both `tools` and `tool_ids` are present.
      // Keep only tool_ids (modern field) when present; otherwise keep tools.
      if (Array.isArray(promptPatch.tool_ids) && promptPatch.tool_ids.length > 0) {
        delete promptPatch.tools;
      } else if (Array.isArray(promptPatch.tools) && promptPatch.tools.length > 0) {
        delete promptPatch.tool_ids;
      } else {
        delete promptPatch.tools;
        delete promptPatch.tool_ids;
      }
      let promptChanged = false;
      if (prompt !== undefined) { promptPatch.prompt = prompt; promptChanged = true; }
      if (llm !== undefined) { promptPatch.llm = llm; promptChanged = true; }
      if (temperature !== undefined) { promptPatch.temperature = temperature; promptChanged = true; }
      if (max_tokens !== undefined) { promptPatch.max_tokens = max_tokens; promptChanged = true; }
      if (promptChanged) agentPatch.prompt = promptPatch;
      if (first_message !== undefined) {
        agentPatch.first_message = first_message;
      }
      conversation_config.agent = agentPatch;
    }

    if (Object.keys(conversation_config).length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nenhum campo enviado para atualizar." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const patchRes = await fetch(baseUrl, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_config }),
    });
    const patchText = await patchRes.text();
    let patchJson: any;
    try { patchJson = JSON.parse(patchText); } catch { patchJson = { raw: patchText }; }

    return new Response(
      JSON.stringify({
        ok: patchRes.ok,
        status: patchRes.status,
        applied: { speed, stability, similarity_boost, expressive_mode, prompt: prompt !== undefined, first_message: first_message !== undefined },
        new_tts: patchJson?.conversation_config?.tts ?? null,
        new_first_message: patchJson?.conversation_config?.agent?.first_message ?? null,
        raw: patchRes.ok ? undefined : patchJson,
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
