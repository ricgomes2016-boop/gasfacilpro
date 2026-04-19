// Edge function: gera token WebRTC efêmero para conversar com o agente Bia (ElevenLabs)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const agentId = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!apiKey || !agentId) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } },
    );

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("ElevenLabs token error:", resp.status, txt);
      return new Response(
        JSON.stringify({ error: "Falha ao obter token", details: txt }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    return new Response(
      JSON.stringify({ token: data.token, agentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
