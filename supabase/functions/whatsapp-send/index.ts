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

// Envio pelo conector WhatsApp da Lovable (número oficial). Usado apenas no canal oficial_forte_gas.
const WHATSAPP_GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";

async function sendViaLovableConnector(
  telefone: string,
  opts: { text?: string; mediaUrl?: string; mediaType?: string; filename?: string },
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connectionKey = Deno.env.get("WHATSAPP_API_KEY");
  if (!lovableKey || !connectionKey) return { ok: false, error: "Conector WhatsApp não configurado" };

  const to = String(telefone).replace(/\D/g, "");
  let payload: Record<string, unknown>;
  if (opts.mediaUrl && opts.mediaType) {
    const tipo = ["image", "video", "audio", "document"].includes(opts.mediaType) ? opts.mediaType : "document";
    payload = {
      messaging_product: "whatsapp",
      to,
      type: tipo,
      [tipo]: {
        link: opts.mediaUrl,
        ...(tipo !== "audio" && opts.text ? { caption: opts.text } : {}),
        ...(tipo === "document" && opts.filename ? { filename: opts.filename } : {}),
      },
    };
  } else {
    payload = { messaging_product: "whatsapp", to, type: "text", text: { body: opts.text || "" } };
  }

  try {
    const resp = await fetch(`${WHATSAPP_GATEWAY_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      console.error(`Conector WhatsApp falhou [${resp.status}]: ${bodyText}`);
      return { ok: false, error: `WhatsApp oficial (${resp.status}): ${bodyText}` };
    }
    let waMessageId: string | undefined;
    try {
      waMessageId = JSON.parse(bodyText)?.messages?.[0]?.id;
    } catch (_) { /* resposta sem JSON */ }
    return { ok: true, waMessageId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Tenant do usuário autenticado (ignorado se service_role)
    let userEmpresaId: string | null = null;
    let userRoles: string[] = [];
    if (!auth.isServiceRole && auth.userId) {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("empresa_id").eq("user_id", auth.userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", auth.userId),
      ]);
      userEmpresaId = prof?.empresa_id ?? null;
      userRoles = (roles || []).map((r: any) => r.role);
      const allowed = ["super_admin", "admin", "gestor", "operacional", "financeiro"];
      if (!userRoles.some((r) => allowed.includes(r))) {
        return json(200, { ok: false, error: "Usuário sem permissão para enviar mensagens (forbidden_role)" });
      }
    }

    const { conversa_id, content, media_url, media_type, mime_type, filename, unidade_id, whatsapp_canal } = await req.json();
    const requestedUnidadeId = typeof unidade_id === "string" && unidade_id.trim() ? unidade_id.trim() : null;

    if (!conversa_id) return json(200, { ok: false, error: "conversa_id é obrigatório" });
    if (!media_url && !content?.trim()) return json(200, { ok: false, error: "Envie content ou media_url" });

    // 1. Conversa
    const { data: conversa } = await supabase
      .from("ai_conversas")
      .select("id, telefone, unidade_id, empresa_id, status, deleted_at, whatsapp_canal")
      .eq("id", conversa_id)
      .maybeSingle();

    if (!conversa?.telefone) return json(200, { ok: false, error: "Conversa sem telefone" });
    if ((conversa as any).deleted_at) return json(200, { ok: false, error: "Conversa excluída" });
    if (conversa.status === "archived" || conversa.status === "closed") {
      return json(200, { ok: false, error: "Conversa arquivada/encerrada — reabra para enviar" });
    }

    // Tenant guard
    if (!auth.isServiceRole && !userRoles.includes("super_admin")) {
      if (!userEmpresaId || conversa.empresa_id !== userEmpresaId) {
        return json(200, { ok: false, error: "Conversa pertence a outra empresa (forbidden_tenant)" });
      }
    }

    let effectiveUnidade = conversa.unidade_id || null;
    if (!effectiveUnidade && requestedUnidadeId) {
      const { data: unidade } = await supabase
        .from("unidades")
        .select("id, empresa_id")
        .eq("id", requestedUnidadeId)
        .maybeSingle();

      if (!unidade) {
        return json(200, { ok: false, error: "Unidade informada não encontrada" });
      }
      if (!auth.isServiceRole && !userRoles.includes("super_admin") && unidade.empresa_id !== userEmpresaId) {
        return json(200, { ok: false, error: "Unidade pertence a outra empresa (forbidden_unidade)" });
      }
      if (conversa.empresa_id && unidade.empresa_id && conversa.empresa_id !== unidade.empresa_id) {
        return json(200, { ok: false, error: "Unidade não pertence à empresa da conversa" });
      }

      effectiveUnidade = requestedUnidadeId;
      await supabase
        .from("ai_conversas")
        .update({ unidade_id: effectiveUnidade, empresa_id: conversa.empresa_id || unidade.empresa_id || null })
        .eq("id", conversa_id)
        .is("unidade_id", null);
    }

    // 2. Config: prioriza o provedor configurado na unidade
    const canal = whatsapp_canal || conversa.whatsapp_canal || null;

    // Canal oficial (número oficial da Forte Gás) → conector WhatsApp da Lovable.
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const WHATSAPP_API_KEY = Deno.env.get("WHATSAPP_API_KEY");
    const useLovableConnector =
      canal === "oficial_forte_gas" && !!LOVABLE_API_KEY && !!WHATSAPP_API_KEY;

    let config: any = null;
    if (!useLovableConnector) {
      const provedores = canal === "oficial_forte_gas"
        ? (["meta"] as const)
        : canal === "zapi_forte_gas"
          ? (["zapi"] as const)
          : (["meta", "evolution", "zapi", "uazapi", "gateway"] as const);
      for (const p of provedores) {
        config = await resolveConfig(supabase, p, effectiveUnidade, null);
        if (config) break;
      }
      if (!config) return json(200, {
        ok: false,
        error: canal === "oficial_forte_gas"
          ? "O canal oficial ainda não foi vinculado ao emissor Meta desta unidade"
          : "Nenhuma integração WhatsApp ativa para a unidade",
      });
    }
    const provedorLabel = useLovableConnector ? "lovable_whatsapp" : config.provedor;

    // 3. Janela 24h (Meta/oficial) — apenas texto livre sofre restrição
    if ((useLovableConnector || config?.provedor === "meta") && !media_url) {
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
        return json(200, {
          ok: false,
          error: "Cliente não interagiu nas últimas 24h. Use um template aprovado pela Meta.",
          requires_template: true,
          out_of_window: true,
        });
      }
    }

    // 4. Insere mensagem PENDING antes do envio
    const metadata: Record<string, any> = { source: "whatsapp-send", provedor: provedorLabel, whatsapp_canal: canal };
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
        whatsapp_canal: canal,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Erro ao inserir mensagem pending:", insertErr);
      return json(200, { ok: false, error: insertErr?.message || "insert_failed" });
    }

    // 5. Envia
    let result: { ok: boolean; waMessageId?: string; error?: string };
    if (useLovableConnector) {
      result = await sendViaLovableConnector(conversa.telefone, {
        text: content?.trim() || undefined,
        mediaUrl: media_url,
        mediaType: media_type,
        filename,
      });
    } else if (media_url && media_type) {
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
        whatsapp_canal: canal,
        event_data: { provedor: provedorLabel, media_type: media_type || null },
      });
      return json(200, { ok: true, provedor: provedorLabel, wa_message_id: result.waMessageId || null });
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
        whatsapp_canal: canal,
        event_data: { provedor: provedorLabel, error: result.error || null },
      });
      return json(200, { ok: false, provedor: provedorLabel, error: result.error || "send_failed" });
    }
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return json(200, { ok: false, error: (error as Error).message });
  }
});
