// whatsapp-send — Envia mensagem do operador humano via WhatsApp com status real
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConfig, sendMessage, sendMedia } from "../_shared/bia-core.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { conversa_id, content, unidade_id, media_url, media_type, mime_type, filename } = await req.json();

    if (!conversa_id) return json(400, { ok: false, error: "conversa_id é obrigatório" });
    if (!media_url && !content?.trim()) return json(400, { ok: false, error: "Envie content ou media_url" });

    // 1. Conversa
    const { data: conversa } = await supabase
      .from("ai_conversas")
      .select("id, telefone, unidade_id, empresa_id, status")
      .eq("id", conversa_id)
      .maybeSingle();

    if (!conversa?.telefone) return json(400, { ok: false, error: "Conversa sem telefone" });
    if (conversa.status === "archived" || conversa.status === "closed") {
      return json(409, { ok: false, error: "Conversa arquivada/encerrada — reabra para enviar" });
    }

    const effectiveUnidade = unidade_id || conversa.unidade_id || null;

    // 2. Config: prioriza o provedor configurado na unidade
    const provedores = ["meta", "evolution", "zapi", "uazapi", "gateway"] as const;
    let config: any = null;
    for (const p of provedores) {
      config = await resolveConfig(supabase, p, effectiveUnidade, null);
      if (config) break;
    }
    if (!config) return json(400, { ok: false, error: "Nenhuma integração WhatsApp ativa para a unidade" });

    // 3. Janela 24h (apenas Meta) — apenas texto livre sofre restrição
    if (config.provedor === "meta" && !media_url) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: lastInbound } = await supabase
        .from("ai_mensagens")
        .select("id, created_at")
        .eq("conversa_id", conversa_id)
        .eq("role", "user")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!lastInbound || lastInbound.length === 0) {
        return json(409, {
          ok: false,
          error: "out_of_window",
          requires_template: true,
          message: "Cliente não interagiu nas últimas 24h. Use um template aprovado pela Meta.",
        });
      }
    }

    // 4. Insere mensagem PENDING antes do envio
    const metadata: Record<string, any> = { source: "whatsapp-send", provedor: config.provedor };
    if (media_url) {
      metadata.media_url = media_url;
      metadata.media_type = media_type;
      metadata.mime_type = mime_type;
      metadata.filename = filename;
    }
    const messageContent = media_url ? (content?.trim() || `[${media_type}]`) : content.trim();

    const { data: inserted, error: insertErr } = await supabase
      .from("ai_mensagens")
      .insert({
        conversa_id,
        role: "human",
        content: messageContent,
        metadata,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Erro ao inserir mensagem pending:", insertErr);
      return json(500, { ok: false, error: insertErr?.message || "insert_failed" });
    }

    // 5. Envia
    let result: { ok: boolean; waMessageId?: string; error?: string };
    if (media_url && media_type) {
      result = await sendMedia(config, conversa.telefone, {
        mediaUrl: media_url,
        mediaType: media_type,
        caption: content?.trim() || undefined,
        filename,
        mimeType: mime_type,
      });
    } else {
      result = await sendMessage(config, conversa.telefone, content.trim());
    }

    // 6. Atualiza status
    const nowIso = new Date().toISOString();
    if (result.ok) {
      await supabase
        .from("ai_mensagens")
        .update({
          status: "sent",
          sent_at: nowIso,
          wa_message_id: result.waMessageId || null,
        })
        .eq("id", inserted.id);
      await supabase.from("ai_conversas").update({ updated_at: nowIso }).eq("id", conversa_id);
      await supabase.from("whatsapp_eventos").insert({
        empresa_id: conversa.empresa_id || null,
        unidade_id: effectiveUnidade,
        conversa_id,
        mensagem_id: inserted.id,
        wa_message_id: result.waMessageId || null,
        contato_wa_id: conversa.telefone,
        event_type: media_url ? "media_sent" : "text_sent",
        event_data: { provedor: config.provedor, media_type: media_type || null },
      });
      return json(200, { ok: true, provedor: config.provedor, wa_message_id: result.waMessageId || null });
    } else {
      await supabase
        .from("ai_mensagens")
        .update({ status: "failed", error_message: result.error || "send_failed" })
        .eq("id", inserted.id);
      await supabase.from("whatsapp_eventos").insert({
        empresa_id: conversa.empresa_id || null,
        unidade_id: effectiveUnidade,
        conversa_id,
        mensagem_id: inserted.id,
        contato_wa_id: conversa.telefone,
        event_type: "send_failed",
        event_data: { provedor: config.provedor, error: result.error || null },
      });
      return json(200, { ok: false, provedor: config.provedor, error: result.error || "send_failed" });
    }
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return json(200, { ok: false, error: (error as Error).message });
  }
});
