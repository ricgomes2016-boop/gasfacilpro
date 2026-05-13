// whatsapp-send — Envia mensagem (texto ou mídia) do operador humano via WhatsApp
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConfig, sendMessage, sendMedia } from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      conversa_id,
      content,
      unidade_id,
      media_url,
      media_type,    // "image" | "audio" | "video" | "document"
      mime_type,
      filename,
    } = await req.json();

    if (!conversa_id) {
      return new Response(JSON.stringify({ error: "conversa_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!media_url && !content?.trim()) {
      return new Response(JSON.stringify({ error: "Envie content ou media_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar telefone + unidade da conversa
    const { data: conversa } = await supabase
      .from("ai_conversas")
      .select("id, telefone, unidade_id")
      .eq("id", conversa_id)
      .maybeSingle();

    if (!conversa?.telefone) {
      return new Response(JSON.stringify({ error: "Conversa sem telefone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveUnidade = unidade_id || conversa.unidade_id || null;

    // 2. Resolver config
    const provedores = ["meta", "evolution", "zapi", "uazapi", "gateway"] as const;
    let config: any = null;
    for (const p of provedores) {
      config = await resolveConfig(supabase, p, effectiveUnidade, null);
      if (config) break;
    }
    if (!config) {
      return new Response(JSON.stringify({ error: "Nenhuma integração WhatsApp ativa encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Enviar
    if (media_url && media_type) {
      await sendMedia(config, conversa.telefone, {
        mediaUrl: media_url,
        mediaType: media_type,
        caption: content?.trim() || undefined,
        filename,
        mimeType: mime_type,
      });
    } else {
      await sendMessage(config, conversa.telefone, content.trim());
    }

    // 4. Salvar no banco
    const messageContent = media_url
      ? (content?.trim() || `[${media_type}]`)
      : content.trim();

    const metadata: Record<string, any> = { source: "whatsapp-send", provedor: config.provedor };
    if (media_url) {
      metadata.media_url = media_url;
      metadata.media_type = media_type;
      metadata.mime_type = mime_type;
      metadata.filename = filename;
    }

    const { error: insertErr } = await supabase.from("ai_mensagens").insert({
      conversa_id,
      role: "human",
      content: messageContent,
      metadata,
    });

    if (insertErr) {
      console.error("Erro ao salvar mensagem:", insertErr);
      return new Response(JSON.stringify({ ok: false, sent: true, error: insertErr.message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("ai_conversas").update({ updated_at: new Date().toISOString() }).eq("id", conversa_id);

    return new Response(JSON.stringify({ ok: true, provedor: config.provedor }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
