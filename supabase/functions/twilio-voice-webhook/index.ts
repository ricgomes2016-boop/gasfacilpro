// Twilio Voice webhook → conecta a chamada à Bia (ElevenLabs Conversational AI)
// Fluxo: Cliente liga no DID GoTo → SIP Trunk (ramal 1004) → Twilio (54.172.60.0:5060)
//        → este webhook (Voice URL no número Twilio) → TwiML <Connect><Stream> → Bia (ElevenLabs)
//
// Adicionalmente:
//  - Identifica a empresa pelo DID de destino (To) via tabela did_empresa_routing
//  - Registra a chamada em chamadas_recebidas (popup Bina no front)
//  - Encaminha caller_phone + empresa_id + empresa_nome como parâmetros para o agente

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlError(msg: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">${escapeXml(msg)}</Say></Response>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!ELEVENLABS_AGENT_ID) {
    console.error("[TWILIO-VOICE] ELEVENLABS_AGENT_ID not configured");
    return new Response(
      twimlError("Desculpe, sistema indispon\u00edvel. Tente novamente em instantes."),
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Parse caller info from Twilio (form-urlencoded em POST, query string em GET)
  let from = "";
  let to = "";
  let callSid = "";
  try {
    let params: URLSearchParams;
    if (req.method === "GET") {
      params = new URL(req.url).searchParams;
    } else {
      const text = await req.text();
      params = new URLSearchParams(text);
    }
    from = params.get("From") || params.get("Caller") || params.get("SipHeader_From") || "";
    to =
      params.get("To") ||
      params.get("Called") ||
      params.get("SipHeader_To") ||
      params.get("SipHeader_Diversion") ||
      params.get("SipHeader_X-Original-To") ||
      "";

    // Limpa formato SIP (sip:+554337717463@host) → +554337717463
    const sipMatch = to.match(/(?:sip:)?(\+?\d{8,15})/i);
    if (sipMatch) to = sipMatch[1];
    if (to && !to.startsWith("+") && to.length >= 10) to = "+" + to.replace(/\D/g, "");

    callSid = params.get("CallSid") || "";
    console.log("[TWILIO-VOICE] Incoming call:", { method: req.method, from, to, callSid });
  } catch (e) {
    console.error("[TWILIO-VOICE] parse error:", e);
  }

  // Resolve empresa pelo DID (To). Fallback: Forte Gás (DID +554337717463)
  let empresaId: string | null = null;
  let empresaNome = "";
  let unidadeId: string | null = null;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      if (to) {
        const { data: routing, error: rErr } = await supabase
          .rpc("resolver_empresa_por_did", { _did: to });

        if (rErr) {
          console.error("[TWILIO-VOICE] resolver_empresa_por_did error:", rErr);
        } else if (routing && routing.length > 0) {
          empresaId = routing[0].empresa_id;
          empresaNome = routing[0].empresa_nome ?? "";
          unidadeId = routing[0].unidade_id ?? null;
          console.log("[TWILIO-VOICE] Empresa resolvida pelo DID:", { to, empresaId, empresaNome });
        } else {
          console.warn("[TWILIO-VOICE] Nenhuma empresa mapeada para DID:", to);
        }
      }

      // Fallback: se não resolveu, usa o DID padrão da Forte Gás
      if (!empresaId) {
        const { data: fallback } = await supabase
          .rpc("resolver_empresa_por_did", { _did: "+554337717463" });
        if (fallback && fallback.length > 0) {
          empresaId = fallback[0].empresa_id;
          empresaNome = fallback[0].empresa_nome ?? "";
          unidadeId = fallback[0].unidade_id ?? null;
          console.log("[TWILIO-VOICE] Fallback Forte Gás aplicado:", { empresaId, empresaNome });
        }
      }

      // Tenta resolver cliente pelo telefone (caller)
      let clienteId: string | null = null;
      let clienteNome: string | null = null;
      const digits = from.replace(/\D/g, "");
      if (digits.length >= 8) {
        const last = digits.slice(-11);
        let q = supabase
          .from("clientes")
          .select("id, nome, telefone, empresa_id")
          .or(`telefone.ilike.%${last}%,telefone.ilike.%${last.slice(-10)}%`)
          .limit(1);
        if (empresaId) q = q.eq("empresa_id", empresaId);
        const { data: cli } = await q;
        if (cli && cli.length > 0) {
          clienteId = cli[0].id;
          clienteNome = cli[0].nome;
        }
      }

      // Registra a chamada (popup Bina via realtime/polling)
      const { error: insErr } = await supabase
        .from("chamadas_recebidas")
        .insert({
          telefone: from,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          tipo: "telefone",
          status: "recebida",
          empresa_id: empresaId,
        });
      if (insErr) {
        console.error("[TWILIO-VOICE] insert chamadas_recebidas error:", insErr);
      }
    } catch (e) {
      console.error("[TWILIO-VOICE] DB lookup error:", e);
    }
  }

  // ElevenLabs Conversational AI WebSocket URL com o agent_id
  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(ELEVENLABS_AGENT_ID)}`;

  // Custom params são entregues ao agente como dynamic variables
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}">
      <Parameter name="caller_phone" value="${escapeXml(from)}" />
      <Parameter name="called_number" value="${escapeXml(to)}" />
      <Parameter name="call_sid" value="${escapeXml(callSid)}" />
      <Parameter name="empresa_id" value="${escapeXml(empresaId ?? "")}" />
      <Parameter name="empresa_nome" value="${escapeXml(empresaNome)}" />
      <Parameter name="unidade_id" value="${escapeXml(unidadeId ?? "")}" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
