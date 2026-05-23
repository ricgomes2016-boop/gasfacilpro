// Twilio Voice webhook → Bia (ElevenLabs Conversational AI) — DIRETO, sem GoTo/Vonage/Vapi.
//
// Fluxo atual:
//   Cliente disca 0800 OU DID 4337-7717-463
//        → operadora encaminha para o número Twilio +55 43 2398-0020
//        → Twilio dispara este webhook (Voice URL configurado no número)
//        → resolvemos empresa pelo DID original (To/Diversion/X-Original-To)
//        → registramos em `chamadas_recebidas`
//        → respondemos com TwiML do ElevenLabs (Bia atende em tempo real).
//
// Quando o caller-id original se perde no encaminhamento (sentinel 0000…,
// número da própria operadora, etc.), marcamos `caller_confiavel=false` e a
// Bia pede o telefone verbalmente.

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

async function registerElevenLabsTwilioCall(
  agentId: string,
  fromNumber: string,
  toNumber: string,
  dynamicVariables: Record<string, string>,
) {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return null;

  const response = await fetch(
    "https://api.elevenlabs.io/v1/convai/twilio/register-call",
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        from_number: fromNumber,
        to_number: toNumber,
        direction: "inbound",
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("[TWILIO-VOICE] ElevenLabs register-call error:", response.status, details);
    return null;
  }

  const twiml = await response.text();
  return twiml.trim().startsWith("<") ? twiml : null;
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
  let rawBodyText = "";
  let postParams: Record<string, string> = {};
  try {
    let params: URLSearchParams;
    if (req.method === "GET") {
      params = new URL(req.url).searchParams;
    } else {
      rawBodyText = await req.text();
      params = new URLSearchParams(rawBodyText);
      for (const [k, v] of params.entries()) postParams[k] = v;
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

  // Verify Twilio signature (HMAC-SHA1) to prevent fake call injection
  // and ElevenLabs credit abuse. See https://www.twilio.com/docs/usage/webhooks/webhooks-security
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (TWILIO_AUTH_TOKEN) {
    const signature = req.headers.get("x-twilio-signature") || "";
    try {
      const fullUrl = req.url;
      let dataToSign = fullUrl;
      if (req.method === "POST") {
        const sortedKeys = Object.keys(postParams).sort();
        for (const k of sortedKeys) dataToSign += k + postParams[k];
      }
      const keyData = new TextEncoder().encode(TWILIO_AUTH_TOKEN);
      const msgData = new TextEncoder().encode(dataToSign);
      const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
      );
      const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
      const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
      if (signature !== expected) {
        console.warn("[TWILIO-VOICE] Invalid Twilio signature", { got: signature?.substring(0, 12), expected: expected.substring(0, 12) });
        return new Response(twimlError("Acesso negado."), {
          status: 403, headers: { "Content-Type": "text/xml" },
        });
      }
    } catch (e) {
      console.error("[TWILIO-VOICE] signature verification error:", e);
      return new Response(twimlError("Erro de autenticação."), {
        status: 403, headers: { "Content-Type": "text/xml" },
      });
    }
  } else {
    console.warn("[TWILIO-VOICE] TWILIO_AUTH_TOKEN not set — skipping signature verification");
  }


  // Caller-id trust check.
  // Vonage forwards calls into Twilio with `from = '0000000000'` (sentinel)
  // when the original caller-id was lost (e.g. PSTN forward from GoTo 0800).
  // Also treat known operator numbers as untrusted.
  const fromDigits = from.replace(/\D/g, "");
  const fromLast10 = fromDigits.slice(-10);
  const OPERATOR_LAST10 = new Set<string>([
    "4323980020", // Twilio DID Central (caller após forward da operadora)
    "4337717463", // DID Forte Gás (caso operadora encaminhe usando o próprio DID como caller)
    "8005900492", // 0800 Forte Gás
    "5900492",
  ]);
  const callerConfiavel =
    fromDigits.length >= 10 &&
    !fromDigits.match(/^0+$/) &&
    !OPERATOR_LAST10.has(fromLast10);

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

      // Tenta resolver cliente pelo telefone (caller) — APENAS se confiável
      let clienteId: string | null = null;
      let clienteNome: string | null = null;
      if (callerConfiavel) {
        const last = fromDigits.slice(-11);
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
      } else {
        console.log("[TWILIO-VOICE] caller_id não confiável - pulando lookup de cliente", { from, fromLast10 });
      }

      // Registra a chamada (popup Bina via realtime/polling)
      // Quando caller não é confiável, salvamos null em telefone para evitar
      // associação errada com a empresa/operadora, e marcamos nas observações.
      const { error: insErr } = await supabase
        .from("chamadas_recebidas")
        .insert({
          telefone: callerConfiavel ? from : null,
          did: to || null,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          tipo: "voip",
          status: "recebida",
          empresa_id: empresaId,
          unidade_id: unidadeId,
          observacoes: callerConfiavel
            ? null
            : `Encaminhada via 0800/operadora (caller-id não recebido). From bruto: ${from || "vazio"}`,
        });
      if (insErr) {
        console.error("[TWILIO-VOICE] insert chamadas_recebidas error:", insErr);
      }
    } catch (e) {
      console.error("[TWILIO-VOICE] DB lookup error:", e);
    }
  }

  const safeFrom = from.startsWith("+") ? from : `+${from.replace(/\D/g, "")}`;
  const safeTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

  // Carrega tabela oficial de preços (configuracoes_empresa.regras_bia.tabela_precos)
  // para injetar como dynamic_variables. Sem isso, o prompt fica com {{preco_*}}
  // vazio e o modelo alucina valores (ex.: R$ 102 quando o real é R$ 125).
  const precoVars: Record<string, string> = {
    preco_gas_p13: "",
    preco_gas_p13_desconto: "",
    preco_gas_p20: "",
    preco_gas_p20_desconto: "",
    preco_gas_p45: "",
    preco_gas_p45_desconto: "",
    preco_agua_20l: "",
    preco_agua_20l_desconto: "",
  };
  if (empresaId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: cfg } = await supabase
        .from("configuracoes_empresa")
        .select("regras_bia")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      const tp = (cfg?.regras_bia as any)?.tabela_precos || {};
      const fmt = (n: any) => {
        const v = Number(n);
        return v > 0 ? v.toFixed(2).replace(".", ",") : "";
      };
      precoVars.preco_gas_p13 = fmt(tp.gas_p13?.preco);
      precoVars.preco_gas_p13_desconto = fmt(tp.gas_p13?.preco_desconto);
      precoVars.preco_gas_p20 = fmt(tp.gas_p20?.preco);
      precoVars.preco_gas_p20_desconto = fmt(tp.gas_p20?.preco_desconto);
      precoVars.preco_gas_p45 = fmt(tp.gas_p45?.preco);
      precoVars.preco_gas_p45_desconto = fmt(tp.gas_p45?.preco_desconto);
      precoVars.preco_agua_20l = fmt(tp.agua_20l?.preco);
      precoVars.preco_agua_20l_desconto = fmt(tp.agua_20l?.preco_desconto);
      console.log("[TWILIO-VOICE] dynamic preço vars:", precoVars);
    } catch (e) {
      console.error("[TWILIO-VOICE] erro carregando tabela_precos:", e);
    }
  }

  const twiml = await registerElevenLabsTwilioCall(ELEVENLABS_AGENT_ID, safeFrom, safeTo, {
    caller_phone: callerConfiavel ? from : "",
    caller_confiavel: callerConfiavel ? "true" : "false",
    called_number: to,
    call_sid: callSid,
    empresa_id: empresaId ?? "",
    empresa_nome: empresaNome,
    unidade_id: unidadeId ?? "",
    ...precoVars,
  });

  if (!twiml) {
    return new Response(
      twimlError("Desculpe, a Bia está indisponível no momento. Tente novamente em instantes."),
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  return new Response(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
