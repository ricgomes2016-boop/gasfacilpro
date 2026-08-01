// ElevenLabs Post-Call Webhook
// Chamado pela ElevenLabs DEPOIS que a conversa termina, com transcript completo,
// duração e metadados. Configurado em: Workspace → Webhooks → post_call_transcription.
//
// Assinatura HMAC validada via header `ElevenLabs-Signature` no formato:
//   t=<unix_timestamp>,v0=<hex_hmac_sha256>
// HMAC = SHA256(secret, `${t}.${raw_body}`)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, elevenlabs-signature",
};

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };

  // Header: "t=1730000000,v0=abcdef..."
  const parts = signatureHeader.split(",").reduce<Record<string, string>>(
    (acc, kv) => {
      const [k, v] = kv.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    },
    {},
  );

  const t = parts["t"];
  const v0 = parts["v0"];
  if (!t || !v0) return { ok: false, reason: "malformed_signature" };

  // Tolerância: 30 minutos
  const ts = Number(t);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 1800) return { ok: false, reason: "stale" };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Compare timing-safe-ish
  if (hex.length !== v0.length) return { ok: false, reason: "len_mismatch" };
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v0.charCodeAt(i);
  return diff === 0 ? { ok: true } : { ok: false, reason: "hmac_mismatch" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();
  const sigHeader = req.headers.get("elevenlabs-signature") || req.headers.get("ElevenLabs-Signature");
  const secret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");

  if (secret) {
    const verify = await verifySignature(rawBody, sigHeader, secret);
    if (!verify.ok) {
      console.warn("[EL-POSTCALL] signature invalid:", verify.reason);
      // 200 OK com flag para não causar retry storm (padrão do projeto)
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_signature", reason: verify.reason }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } else {
    console.error("[EL-POSTCALL] ELEVENLABS_WEBHOOK_SECRET not set — rejecting request");
    return new Response(
      JSON.stringify({ ok: false, error: "webhook_secret_not_configured" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: any = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
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
            status: "atendida",
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
            status: "atendida",
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
