// Vonage Voice webhook → conecta a chamada à Bia (ElevenLabs Conversational AI)
// Fluxo: Cliente liga no DID Vonage (+55 11 5283-5921)
//        → Vonage (Answer URL aponta pra esta function)
//        → NCCO retorna <connect><websocket> apontando pra ElevenLabs
//
// Configuração no painel Vonage:
//   Voice → Application → Capabilities → Voice
//   Answer URL (GET):  https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vonage-voice-webhook
//   Event URL  (POST): https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vonage-voice-webhook?event=1
//   Linkar o número +5511 5283-5921 a essa Application.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const isEvent = url.searchParams.get("event") === "1";

  const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // ---- EVENT URL: apenas loga e responde 200 ----
  if (isEvent) {
    try {
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      console.log("[VONAGE-EVENT]", JSON.stringify(body));
    } catch (e) {
      console.error("[VONAGE-EVENT] parse error:", e);
    }
    return jsonResponse({ ok: true });
  }

  // ---- ANSWER URL: precisa retornar NCCO ----
  if (!ELEVENLABS_AGENT_ID) {
    console.error("[VONAGE-VOICE] ELEVENLABS_AGENT_ID not configured");
    return jsonResponse([
      { action: "talk", language: "pt-BR", text: "Desculpe, sistema indisponível. Tente novamente em instantes." },
    ]);
  }

  // Vonage manda os parâmetros via query string em GET (Answer URL padrão é GET)
  // ou JSON body em POST (se configurado).
  let from = "";
  let to = "";
  let uuid = "";
  let conversation_uuid = "";

  try {
    if (req.method === "GET") {
      from = url.searchParams.get("from") || "";
      to = url.searchParams.get("to") || "";
      uuid = url.searchParams.get("uuid") || "";
      conversation_uuid = url.searchParams.get("conversation_uuid") || "";
    } else {
      const body = await req.json().catch(() => ({} as any));
      from = body.from || "";
      to = body.to || "";
      uuid = body.uuid || "";
      conversation_uuid = body.conversation_uuid || "";
    }
  } catch (e) {
    console.error("[VONAGE-VOICE] parse error:", e);
  }

  // Normaliza para E.164
  const normalize = (n: string) => {
    if (!n) return "";
    const digits = n.replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("+") ? digits : `+${digits}`;
  };
  from = normalize(from);
  to = normalize(to);

  console.log("[VONAGE-VOICE] Incoming call:", { from, to, uuid, conversation_uuid });

  // Resolve empresa pelo DID (To). Fallback: Forte Gás
  let empresaId: string | null = null;
  let empresaNome = "";
  let unidadeId: string | null = null;
  let clienteId: string | null = null;
  let clienteNome: string | null = null;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      if (to) {
        const { data: routing, error: rErr } = await supabase
          .rpc("resolver_empresa_por_did", { _did: to });
        if (rErr) {
          console.error("[VONAGE-VOICE] resolver_empresa_por_did error:", rErr);
        } else if (routing && routing.length > 0) {
          empresaId = routing[0].empresa_id;
          empresaNome = routing[0].empresa_nome ?? "";
          unidadeId = routing[0].unidade_id ?? null;
          console.log("[VONAGE-VOICE] Empresa resolvida pelo DID:", { to, empresaId, empresaNome });
        } else {
          console.warn("[VONAGE-VOICE] Nenhuma empresa mapeada para DID:", to);
        }
      }

      // Fallback: Forte Gás
      if (!empresaId) {
        const { data: fallback } = await supabase
          .rpc("resolver_empresa_por_did", { _did: "+554337717463" });
        if (fallback && fallback.length > 0) {
          empresaId = fallback[0].empresa_id;
          empresaNome = fallback[0].empresa_nome ?? "";
          unidadeId = fallback[0].unidade_id ?? null;
          console.log("[VONAGE-VOICE] Fallback Forte Gás aplicado:", { empresaId, empresaNome });
        }
      }

      // Tenta resolver cliente pelo telefone
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

      // Registra a chamada (popup Bina)
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
        console.error("[VONAGE-VOICE] insert chamadas_recebidas error:", insErr);
      }
    } catch (e) {
      console.error("[VONAGE-VOICE] DB lookup error:", e);
    }
  }

  // ElevenLabs Conversational AI WebSocket URL
  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(ELEVENLABS_AGENT_ID)}`;

  // NCCO (Nexmo Call Control Object) - retorna ARRAY JSON
  // 'connect' com 'websocket' faz a ponte bidirecional de áudio com a ElevenLabs
  const ncco = [
    {
      action: "connect",
      from: from || to,
      endpoint: [
        {
          type: "websocket",
          uri: wsUrl,
          "content-type": "audio/l16;rate=16000",
          headers: {
            caller_phone: from,
            called_number: to,
            call_uuid: uuid,
            conversation_uuid: conversation_uuid,
            empresa_id: empresaId ?? "",
            empresa_nome: empresaNome,
            unidade_id: unidadeId ?? "",
            cliente_id: clienteId ?? "",
            cliente_nome: clienteNome ?? "",
          },
        },
      ],
    },
  ];

  return jsonResponse(ncco);
});
