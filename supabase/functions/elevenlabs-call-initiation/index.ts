// ElevenLabs Conversation Initiation Webhook
// Chamado pela ElevenLabs ANTES da conversa começar quando "Fetch initiation
// client data from webhook" está habilitado no agente.
//
// Fluxo: Cliente liga 0800 → GoTo SIP Trunk → ElevenLabs (SIP nativo)
//        → ElevenLabs faz POST aqui com { caller_id, agent_id, called_number, call_sid }
//        → respondemos com dynamic_variables que o agente usa no prompt
//
// Resposta esperada pela ElevenLabs:
// {
//   "type": "conversation_initiation_client_data",
//   "dynamic_variables": { ... },
//   "conversation_config_override": { ... } (opcional)
// }
// Docs: https://elevenlabs.io/docs/agents-platform/customization/personalization/conversation-initiation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

// Mesma lista usada em twilio-voice-webhook / vonage-voice-webhook
const OPERATOR_LAST10 = new Set<string>([
  "1152835921", // Vonage DID Central Gás (legado)
  "8005900492", // GoTo 0800
  "5900492",
]);

function digits(s: string | null | undefined) {
  return String(s ?? "").replace(/\D/g, "");
}

function normalizeE164(s: string | null | undefined) {
  const d = digits(s);
  if (!d) return "";
  return d.startsWith("55") ? "+" + d : d.length >= 10 ? "+55" + d.slice(-11) : "+" + d;
}

function safeEqualInit(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Fail-closed: require ELEVENLABS_WEBHOOK_SECRET via x-admin-secret header
  // (configure this in ElevenLabs Agent > Conversation Initiation Webhook > Headers).
  const expected = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") || "";
  const provided = req.headers.get("x-admin-secret") || "";
  if (!expected || !provided || !safeEqualInit(expected, provided)) {
    console.warn("[EL-INIT] Unauthorized: missing/invalid x-admin-secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  // Sempre 200 OK com fallback seguro — nunca derrubar a chamada por erro nosso
  let body: any = {};
  try {
    if (req.method === "POST") body = await req.json().catch(() => ({}));
    else {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
    }
  } catch (e) {
    console.error("[EL-INIT] parse error:", e);
  }

  // Campos enviados pela ElevenLabs (variam por canal SIP/Twilio)
  const callerId: string =
    body.caller_id || body.from || body.caller || body.from_number || "";
  const calledNumber: string =
    body.called_number || body.to || body.to_number || body.agent_phone_number || "";
  const callSid: string = body.call_sid || body.conversation_id || "";
  const agentId: string = body.agent_id || "";

  console.log("[EL-INIT] Incoming:", { callerId, calledNumber, callSid, agentId });

  const fromDigits = digits(callerId);
  const fromLast10 = fromDigits.slice(-10);
  const callerConfiavel =
    fromDigits.length >= 10 &&
    !/^0+$/.test(fromDigits) &&
    !OPERATOR_LAST10.has(fromLast10);

  // Resolve empresa pelo DID e cliente pelo telefone (se confiável)
  let empresaId: string | null = null;
  let empresaNome = "";
  let unidadeId: string | null = null;
  let clienteId: string | null = null;
  let clienteNome: string | null = null;
  let tabelaPrecosVars: Record<string, string> = {
    preco_gas_p13: "",
    preco_gas_p13_desconto: "",
    preco_gas_p20: "",
    preco_gas_p20_desconto: "",
    preco_gas_p45: "",
    preco_gas_p45_desconto: "",
    preco_agua_20l: "",
  };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // 1) Empresa pelo DID destino
      const didNorm = normalizeE164(calledNumber);
      if (didNorm) {
        const { data: routing, error: rErr } = await supabase.rpc(
          "resolver_empresa_por_did",
          { _did: didNorm },
        );
        if (rErr) console.error("[EL-INIT] resolver_empresa_por_did:", rErr);
        else if (routing && routing.length > 0) {
          empresaId = routing[0].empresa_id;
          empresaNome = routing[0].empresa_nome ?? "";
          unidadeId = routing[0].unidade_id ?? null;
        }
      }

      // Fallback: Forte Gás
      if (!empresaId) {
        const { data: fb } = await supabase.rpc("resolver_empresa_por_did", {
          _did: "+554323980020",
        });
        if (fb && fb.length > 0) {
          empresaId = fb[0].empresa_id;
          empresaNome = fb[0].empresa_nome ?? "";
          unidadeId = fb[0].unidade_id ?? null;
        }
      }

      // 2) Cliente pelo telefone (apenas se confiável)
      if (empresaId && !unidadeId) {
        const { data: unidadePadrao } = await supabase
          .from("unidades")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .order("tipo", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        unidadeId = unidadePadrao?.id ?? null;
      }

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
      }

      // 2.5) Busca tabela de preços oficial da empresa (Regras da Bia)
      // Injetamos os preços direto no contexto do agente para evitar
      // que o LLM (gemini lite) alucine valores quando não chama o tool.
      // Variáveis ficam vazias se faltar dado — Bia cai no consultar_precos.
      // Variáveis ficam vazias se faltar dado — Bia cai no consultar_precos.
      if (empresaId) {
        try {
          const { data: cfg } = await supabase
            .from("configuracoes_empresa")
            .select("regras_bia")
            .eq("empresa_id", empresaId)
            .maybeSingle();
          const tp = (cfg?.regras_bia as any)?.tabela_precos || {};
          const fmt = (n: any) => {
            const v = Number(n);
            if (!v || v <= 0) return "";
            return v.toFixed(2).replace(".", ",");
          };
          tabelaPrecosVars = {
            preco_gas_p13: fmt(tp.gas_p13?.preco),
            preco_gas_p13_desconto: fmt(tp.gas_p13?.preco_desconto),
            preco_gas_p20: fmt(tp.gas_p20?.preco),
            preco_gas_p20_desconto: fmt(tp.gas_p20?.preco_desconto),
            preco_gas_p45: fmt(tp.gas_p45?.preco),
            preco_gas_p45_desconto: fmt(tp.gas_p45?.preco_desconto),
            preco_agua_20l: fmt(tp.agua_20l?.preco),
          };
        } catch (e) {
          console.error("[EL-INIT] tabela_precos load:", e);
        }
      }

      // 3) Registra a chamada (popup Bina via realtime)
      const { error: insErr } = await supabase.from("chamadas_recebidas").insert({
        telefone: callerConfiavel ? callerId : null,
        did: normalizeE164(calledNumber) || null,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        tipo: "voip",
        status: "recebida",
        empresa_id: empresaId,
        unidade_id: unidadeId,
        observacoes: callerConfiavel
          ? `ElevenLabs SIP direto (call_sid: ${callSid})`
          : `Encaminhada via 0800/operadora (caller-id não recebido). From bruto: ${callerId || "vazio"}`,
      });
      if (insErr) console.error("[EL-INIT] insert chamadas_recebidas:", insErr);
    } catch (e) {
      console.error("[EL-INIT] DB error:", e);
    }
  }

  // Resposta no formato que a ElevenLabs espera
  const response = {
    type: "conversation_initiation_client_data",
    dynamic_variables: {
      caller_phone: callerConfiavel ? callerId : "",
      caller_confiavel: callerConfiavel ? "true" : "false",
      called_number: calledNumber,
      call_sid: callSid,
      empresa_id: empresaId ?? "",
      empresa_nome: empresaNome,
      unidade_id: unidadeId ?? "",
      cliente_id: clienteId ?? "",
      cliente_nome: clienteNome ?? "",
      ...tabelaPrecosVars,
    },
  };

  console.log("[EL-INIT] Response:", response);

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
