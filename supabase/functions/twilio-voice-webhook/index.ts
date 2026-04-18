// Twilio Voice webhook → conecta a chamada à Bia (ElevenLabs Conversational AI)
// Twilio chama esta function via POST quando uma chamada chega no número Central Gás.
// Retornamos TwiML com <Connect><Stream> apontando para o WebSocket da ElevenLabs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
  if (!ELEVENLABS_AGENT_ID) {
    console.error("ELEVENLABS_AGENT_ID not configured");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">Desculpe, sistema indisponível. Tente novamente em instantes.</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Parse caller info from Twilio (form-urlencoded)
  let from = "";
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    from = params.get("From") || params.get("Caller") || "";
    console.log("[TWILIO-VOICE] Incoming call from:", from);
  } catch (e) {
    console.error("[TWILIO-VOICE] parse error:", e);
  }

  // ElevenLabs Conversational AI WebSocket URL with the agent_id
  // Custom param "caller_phone" is forwarded as a system variable to the agent
  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="caller_phone" value="${from}" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
