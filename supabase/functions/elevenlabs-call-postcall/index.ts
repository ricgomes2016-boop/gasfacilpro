// ElevenLabs Post-Call Webhook
// Chamado pela ElevenLabs DEPOIS que a conversa termina, com transcript completo,
// duração e metadados. Configurado em: Agent → Webhooks → Post-call.
//
// Payload típico:
// {
//   "type": "post_call_transcription",
//   "data": {
//     "conversation_id": "...",
//     "agent_id": "...",
//     "transcript": [{ role, message, time_in_call_secs }],
//     "metadata": {
//       "call_duration_secs": 45,
//       "phone_call": { "external_number": "+55...", "agent_number": "+55..." }
//     },
//     "analysis": { "transcript_summary": "...", "call_successful": "success" }
//   }
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let payload: any = {};
  try {
    payload = await req.json().catch(() => ({}));
  } catch (e) {
    console.error("[EL-POSTCALL] parse error:", e);
  }

  console.log("[EL-POSTCALL] Type:", payload?.type, "Conv:", payload?.data?.conversation_id);

  const data = payload?.data ?? payload ?? {};
  const conversationId: string = data.conversation_id || data.call_sid || "";
  const durationSecs: number =
    data?.metadata?.call_duration_secs ?? data?.duration_secs ?? 0;
  const externalNumber: string =
    data?.metadata?.phone_call?.external_number || data?.caller_id || "";
  const transcriptArr = Array.isArray(data?.transcript) ? data.transcript : [];
  const summary: string = data?.analysis?.transcript_summary || "";
  const success: string = data?.analysis?.call_successful || "";

  // Concatena transcript em texto legível
  const transcriptText = transcriptArr
    .map((t: any) => {
      const role = t.role === "agent" ? "Bia" : t.role === "user" ? "Cliente" : t.role;
      return `[${t.time_in_call_secs ?? "?"}s] ${role}: ${t.message ?? ""}`;
    })
    .join("\n");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_db" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Encontra a chamada criada pelo initiation webhook (mais recente do mesmo telefone
    // ou que tenha o call_sid nas observações). Se não achar, cria uma nova.
    const fromDigits = externalNumber.replace(/\D/g, "");
    const last10 = fromDigits.slice(-10);

    let updated = false;

    if (conversationId) {
      const { data: byConv } = await supabase
        .from("chamadas_recebidas")
        .select("id")
        .ilike("observacoes", `%${conversationId}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (byConv && byConv.length > 0) {
        const obs =
          `Bia (ElevenLabs SIP) - ${success || "encerrada"}\n` +
          (summary ? `Resumo: ${summary}\n` : "") +
          `call_sid: ${conversationId}\n\n` +
          `--- Transcript ---\n${transcriptText}`;
        const { error } = await supabase
          .from("chamadas_recebidas")
          .update({
            status: "finalizada",
            duracao_segundos: durationSecs,
            observacoes: obs.slice(0, 8000),
          })
          .eq("id", byConv[0].id);
        if (error) console.error("[EL-POSTCALL] update by conv:", error);
        else updated = true;
      }
    }

    if (!updated && last10) {
      const { data: byPhone } = await supabase
        .from("chamadas_recebidas")
        .select("id")
        .ilike("telefone", `%${last10}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (byPhone && byPhone.length > 0) {
        const obs =
          `Bia (ElevenLabs SIP) - ${success || "encerrada"}\n` +
          (summary ? `Resumo: ${summary}\n` : "") +
          `call_sid: ${conversationId}\n\n` +
          `--- Transcript ---\n${transcriptText}`;
        await supabase
          .from("chamadas_recebidas")
          .update({
            status: "finalizada",
            duracao_segundos: durationSecs,
            observacoes: obs.slice(0, 8000),
          })
          .eq("id", byPhone[0].id);
        updated = true;
      }
    }

    console.log("[EL-POSTCALL] updated:", updated, "duration:", durationSecs);
  } catch (e) {
    console.error("[EL-POSTCALL] DB error:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
