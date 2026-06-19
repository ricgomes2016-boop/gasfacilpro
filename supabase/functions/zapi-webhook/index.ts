// zapi-webhook — BIA WhatsApp via Z-API (thin wrapper over bia-core)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, sendLocation, registerCall,
  downloadAudio, transcribeAudio, getEntregadorLocation,
  getOffHoursMessage,
  identifyContact, checkRateLimit, processCancelTagInReply, stripPedidoConfirmadoBlock,
  ORDER_CONFIRMATION_REGEX, recoverOrderBlock,
  type BiaConfig,
} from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const OK = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createSupabase();
    const body = await req.json();
    console.log("Z-API webhook:", JSON.stringify(body).substring(0, 800));

    // Authenticate webhook: if a security_token is configured on the integration,
    // require it on the incoming request (via header or query string). Z-API
    // sends it in the "Client-Token" / "Security-Token" headers.
    const incomingToken =
      req.headers.get("client-token") ||
      req.headers.get("security-token") ||
      req.headers.get("x-security-token") ||
      new URL(req.url).searchParams.get("security_token") ||
      "";

    // Skip own messages and non-messages
    if (body.fromMe === true) return OK({ ok: true, skipped: "fromMe" });
    const isAudio = body.type === "audio" || body.type === "ptt" || body.isAudio === true || !!body.audio || !!body.audioMessage;
    if (!isAudio && !(body.type === "ReceivedCallback" || body.isNewMsg === true || body.status === "RECEIVED")) return OK({ ok: true, skipped: "not_message" });

    const phone = body.phone || body.from || "";
    let messageText = body.text?.message || body.body || body.text || "";
    const senderName = body.senderName || body.chatName || "";
    // Robust audio URL extraction for Z-API various payload formats
    const audioUrl = body.audio?.audioUrl || body.audio?.url || body.audioMessage?.url || body.audioMessage?.audioUrl || body.mediaUrl || (typeof body.audio === "string" ? body.audio : null) || null;
    if (isAudio) console.log("Audio detected:", JSON.stringify({ type: body.type, hasAudio: !!body.audio, hasAudioMessage: !!body.audioMessage, audioUrl: audioUrl?.substring(0, 80) }));
    if (body.isGroup === true || !phone) return OK({ ok: true, skipped: "invalid" });

    // Handle audio: transcribe voice note to text
    if (isAudio || (audioUrl && typeof audioUrl === "string" && !messageText)) {
      // Need config first for audio download
      const url0 = new URL(req.url);
      const cfg0 = await resolveConfig(supabase, "zapi", url0.searchParams.get("unidade_id"), body.instanceId || body.instance_id || null);
      if (cfg0 && audioUrl) {
        const audio = await downloadAudio(cfg0, audioUrl);
        if (audio) {
          const transcribed = await transcribeAudio(audio.base64, audio.mimeType);
          if (transcribed) {
            messageText = transcribed;
            console.log("Audio transcribed:", messageText.substring(0, 80));
          } else {
            await sendMessage(cfg0, phone, "Desculpe, não consegui entender o áudio. Pode digitar ou enviar novamente? 😊");
            return OK({ ok: true, skipped: "audio_unreadable" });
          }
        } else {
          await sendMessage(cfg0, phone, "Desculpe, não consegui ouvir o áudio. Pode mandar por texto? 😊");
          return OK({ ok: true, skipped: "audio_download_failed" });
        }
      } else if (!messageText) {
        return OK({ ok: true, skipped: "audio_no_config" });
      }
    }

    if (!messageText) return OK({ ok: true, skipped: "empty" });

    // Resolve config
    const url = new URL(req.url);
    const config = await resolveConfig(supabase, "zapi", url.searchParams.get("unidade_id"), body.instanceId || body.instance_id || null);

    // Fallback to env secrets (legacy)
    let finalConfig: BiaConfig;
    if (config) {
      finalConfig = config;
    } else {
      const envId = Deno.env.get("ZAPI_INSTANCE_ID");
      const envToken = Deno.env.get("ZAPI_TOKEN");
      if (!envId || !envToken) throw new Error("Z-API credentials not configured");
      finalConfig = {
        instanceId: envId, token: envToken,
        securityToken: Deno.env.get("ZAPI_SECURITY_TOKEN") || null,
        unidadeId: null, descontoEtapa1: 5, descontoEtapa2: 10,
        precoMinimoP13: null, precoMinimoP20: null, provedor: "zapi",
      };
    }

    // Z-API uses Client-Token for outbound API calls. Some webhook deliveries do
    // not include it, so only reject when a token is explicitly sent and wrong.
    if (finalConfig.securityToken && incomingToken && incomingToken !== finalConfig.securityToken) {
      console.warn("Z-API webhook: invalid security token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizePhone(phone);
    const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);
    const messageKey = body.messageId ? String(body.messageId) : `${normalized}_${body.momment || ""}_${messageText.trim().toLowerCase()}`;

    // Dedup
    if (await isDuplicate(supabase, conversationId, messageKey)) return OK({ ok: true, skipped: "duplicate" });

    // Send typing indicator immediately
    sendTyping(finalConfig, phone);

    // Gather context
    const [cliente, bh, products, history, contact] = await Promise.all([
      findCliente(supabase, phone, senderName),
      checkBusinessHours(supabase, finalConfig.unidadeId),
      getProducts(supabase, finalConfig.unidadeId, finalConfig),
      loadHistory(supabase, conversationId),
      identifyContact(supabase, phone),
    ]);
    const [recentOrders, orderStatus] = await Promise.all([
      getRecentOrders(supabase, cliente.id),
      getOrderStatus(supabase, cliente.id, normalized),
    ]);

    // Keep the conversation scoped before the message insert so realtime
    // notification triggers can resolve empresa/unidade on the first message.
    await upsertConversation(supabase, conversationId, `WhatsApp: ${cliente.nome || senderName || normalized}`, normalized, finalConfig?.unidadeId || null);
    await saveMessage(supabase, conversationId, "user", messageText, {
      source: "zapi-webhook", message_id: messageKey,
      raw_message_id: body.messageId ?? null, moment: body.momment ?? null,
      tipo_contato: contact.tipo, contato_id: contact.id || null,
    });

    // Hard block: off-hours → fixed message, no AI
    if (bh.isOffHours) {
      const reply = getOffHoursMessage(cliente.nome, bh.horarioInfo);
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "zapi-webhook", off_hours: true });
      await sendMessage(finalConfig, phone, reply);
      return OK({ ok: true, skipped: "off_hours" });
    }

    // Post-order follow-up shortcut
    const postOrderResult = await isPostOrderFollowUp(supabase, normalized, messageText);
    if (postOrderResult === "rating") {
      const reply = "Obrigado pela avaliação! ⭐ Sua opinião é muito importante para nós. Até a próxima! 😊";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "zapi-webhook", rating_response: true });
      await sendMessage(finalConfig, phone, reply);
      return OK({ ok: true });
    }
    if (postOrderResult === true) {
      const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 20 a 40 minutos).";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "zapi-webhook", post_order_followup: true });
      await sendMessage(finalConfig, phone, reply);
      return OK({ ok: true, skipped: "post_order_followup" });
    }

    // Rate limit check: max 10 messages per 2 hours per conversation
    const isRateLimited = await checkRateLimit(supabase, conversationId, 10, 2);
    if (isRateLimited) {
      console.warn(`Rate limited conversation ${conversationId} — skipping AI call`);
      return OK({ ok: true, skipped: "rate_limited" });
    }

    // Build prompt with negotiation hint
    const negHint = buildNegotiationHint(history, finalConfig, messageText);
    const systemPrompt = buildSystemPrompt(products, cliente, recentOrders, normalized, finalConfig, bh.isOffHours, bh.horarioInfo, orderStatus, negHint, { isSunday: bh.isSunday, waterDeliveryAllowed: bh.waterDeliveryAllowed }, history, { entrega: bh.gasDoPovoEntrega ?? false, taxa: bh.gasDoPovoTaxa ?? 15 }, contact, bh.unidadeLocation);

    // Call AI
    let reply: string;
    try {
      reply = await callAI([
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: messageText },
      ]);
    } catch (e: any) {
      const fallback = e.message === "RATE_LIMIT"
        ? "Desculpe, estamos com muitas mensagens. Tente novamente! 😊"
        : "Desculpe, tive um problema técnico. Ligue para nós! 📞";
      await sendMessage(finalConfig, phone, fallback);
      return OK({ ok: true, fallback: true });
    }

    // Parse order tag from raw reply BEFORE cleaning
    const rawReply = reply;
    const orderMatch = rawReply.match(/\[PEDIDO_CONFIRMADO\]([\s\S]*?)\[\/PEDIDO_CONFIRMADO\]/);

    // Strip internal tag before saving / sending
    reply = stripPedidoConfirmadoBlock(reply);

    await saveMessage(supabase, conversationId, "assistant", reply);

    // Process cancellation tag
    { const cancelRes = await processCancelTagInReply(supabase, reply, cliente.id); reply = cancelRes.reply; }

    // Process order
    if (orderMatch) {
      const orderData = parseOrderData(orderMatch[1]);
      if (orderData) {
        // Dedup: 2 min window
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: dup } = await supabase.from("pedidos").select("id")
          .eq("canal_venda", "whatsapp").gte("created_at", twoMinAgo)
          .ilike("observacoes", `%${normalized}%`).limit(1);

        if (dup?.length) {
          reply += "\n\nSeu pedido já foi registrado! Aguarde a entrega 😊";
        } else {
          const isAgendado = bh.isOffHours || orderData.agendado === "sim";
          const { data: prevMsgs } = await supabase.from("ai_mensagens").select("content")
            .eq("conversa_id", conversationId).eq("role", "assistant")
            .order("created_at", { ascending: false }).limit(30);
          const discount = extractLatestNegotiatedDiscountPerUnit([rawReply, ...(prevMsgs || []).map((m: any) => m.content)]);

          const orderResult = await createOrder(supabase, orderData, cliente.id, cliente.nome, senderName, normalized, finalConfig.unidadeId, isAgendado, discount);
          await registerCall(supabase, phone, cliente.id, cliente.nome, senderName, finalConfig.unidadeId, orderResult?.pedidoId);
        }
      }
    }

    // Handle location sharing
    if (reply.includes("[ENVIAR_LOCALIZACAO]")) {
      reply = reply.replace(/\[ENVIAR_LOCALIZACAO\]/g, "").trim();
      const loc = await getEntregadorLocation(supabase, cliente.id);
      if (loc) {
        // Send text first, then location pin
        await sendMessage(finalConfig, phone, reply);
        await sendLocation(finalConfig, phone, loc.lat, loc.lng, loc.nome);
        return OK({ ok: true, reply: reply.substring(0, 100), location_sent: true });
      }
    }

    await sendMessage(finalConfig, phone, reply);

    // Auto follow-up for negotiation — only if auto_followup_ativo is enabled
    if (bh.autoFollowupAtivo) {
    const replyLower = reply.toLowerCase();
    const mentionedMgr = replyLower.includes("verificar com o gerente") || replyLower.includes("falar com o gerente") ||
      replyLower.includes("consultar o gerente") || (replyLower.includes("um momento") && !replyLower.includes("desconto"));
    const hasDiscount = replyLower.includes("desconto") && replyLower.includes("r$");

    if (mentionedMgr && !hasDiscount && finalConfig.descontoEtapa1 > 0) {
      await new Promise(r => setTimeout(r, 5000));

      // Race check
      const { data: newer } = await supabase.from("ai_mensagens").select("id")
        .eq("conversa_id", conversationId).eq("role", "user")
        .gt("created_at", new Date(Date.now() - 4000).toISOString()).limit(1);
      if (newer?.length) return OK({ ok: true, skipped: "newer_msg" });

      // Dedup follow-up
      const { data: existFU } = await supabase.from("ai_mensagens").select("id")
        .eq("conversa_id", conversationId).eq("role", "assistant")
        .contains("metadata", { auto_followup_for: messageKey }).limit(1);
      if (existFU?.length) return OK({ ok: true, skipped: "dup_followup" });

      // Get actual products for prices
      const { data: allProds } = await supabase.from("produtos").select("nome, preco").eq("ativo", true);
      const p13 = allProds?.find((p: any) => /p\s*13|13\s*kg/i.test(p.nome));
      const p20 = allProds?.find((p: any) => /p\s*20|20\s*kg/i.test(p.nome));
      const p13B = p13 ? Number(p13.preco) : null;
      const p20B = p20 ? Number(p20.preco) : null;

      const { data: freshHist } = await supabase.from("ai_mensagens").select("content")
        .eq("conversa_id", conversationId).eq("role", "assistant").order("created_at", { ascending: true });
      const dcCount = (freshHist || []).filter((m: any) => {
        const c = m.content.toLowerCase();
        return (c.includes("consegui") || c.includes("desconto especial") || c.includes("desconto total")) && c.includes("r$") && c.includes("desconto");
      }).length;

      const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
      let fu: string;
      if (dcCount >= 1) {
        const lines = ["Consegui falar com o gerente novamente ✅", `Fechamos no valor mínimo: desconto total de ${fmt(finalConfig.descontoEtapa2)}/un.`];
        if (p13B) lines.push(`• P13: de ${fmt(p13B)} por ${fmt(finalConfig.precoMinimoP13 ?? p13B - finalConfig.descontoEtapa2)}`);
        if (p20B) lines.push(`• P20: de ${fmt(p20B)} por ${fmt(finalConfig.precoMinimoP20 ?? p20B - finalConfig.descontoEtapa2)}`);
        lines.push("Esse é o menor preço. Posso confirmar?");
        fu = lines.join("\n");
      } else {
        const lines = ["Consegui um desconto com o gerente ✅", `Desconto especial de ${fmt(finalConfig.descontoEtapa1)}/un.`];
        if (p13B) lines.push(`• P13: de ${fmt(p13B)} por ${fmt(p13B - finalConfig.descontoEtapa1)}`);
        if (p20B) lines.push(`• P20: de ${fmt(p20B)} por ${fmt(p20B - finalConfig.descontoEtapa1)}`);
        lines.push("Posso confirmar seu pedido?");
        fu = lines.join("\n");
      }

      await saveMessage(supabase, conversationId, "assistant", fu, { source: "zapi-webhook", auto_followup_for: messageKey });
      await sendMessage(finalConfig, phone, fu);
    }
    } // end auto_followup_ativo check

    return OK({ ok: true, reply: reply.substring(0, 100) });
  } catch (error) {
    console.error("Z-API webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
