// evolution-webhook — BIA WhatsApp via Evolution API (thin wrapper over bia-core)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, sendLocation, registerCall, getEntregadorLocation,
  downloadAudio, transcribeAudio, collectBufferedMessages, getOffHoursMessage,
  identifyContact, checkRateLimit, processCancelTagInReply, stripPedidoConfirmadoBlock,
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
    console.log("Evolution webhook received:", JSON.stringify(body).substring(0, 500));

    // Evolution API sends various event types. We are interested in MESSAGES_UPSERT
    if (body.event !== "messages.upsert") {
      return OK({ ok: true, skipped: "not_messages_upsert", event: body.event });
    }

    const payload = body.data;
    if (!payload || !payload.key) return OK({ ok: true, skipped: "no_data" });

    // Skip own messages
    if (payload.key.fromMe === true) return OK({ ok: true, skipped: "fromMe" });

    const phone = payload.key.remoteJid?.split("@")[0] || "";
    const senderName = payload.pushName || "";
    const isGroup = payload.key.remoteJid?.includes("@g.us");

    if (isGroup || !phone) return OK({ ok: true, skipped: "invalid" });

    // Resolve config early for audio/typing
    const url = new URL(req.url);
    const instanceName = body.instance || url.searchParams.get("instance") || null;
    const config = await resolveConfig(supabase, "evolution", url.searchParams.get("unidade_id"), instanceName);

    if (!config) {
      console.error("No config found for Evolution instance:", instanceName);
      return OK({ ok: true, skipped: "no_config" });
    }

    // Enforce instance token: Evolution forwards apikey/Authorization header on webhooks.
    // If we have a token stored for this instance, require it.
    const incomingToken =
      req.headers.get("apikey") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      req.headers.get("x-evolution-apikey") ||
      url.searchParams.get("apikey") ||
      "";
    const expectedToken = (config as any).instanciaToken || (config as any).token || null;
    if (expectedToken && incomingToken !== expectedToken) {
      console.warn("Evolution webhook: invalid or missing instance token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text from various message types (conversation, extendedTextMessage, imageMessage, etc.)
    let messageText = payload.message?.conversation || 
                       payload.message?.extendedTextMessage?.text || 
                       payload.message?.imageMessage?.caption || 
                       "";

    // Handle audio: voice notes
    const audioMessage = payload.message?.audioMessage;
    const isAudio = !!audioMessage || payload.messageType === "audioMessage";
    
    if (isAudio) {
      // For Evolution, media URL might be in the payload or needs to be constructed/fetched
      // In latest versions, it often provides a URL or requires using the download endpoint
      const mediaUrl = audioMessage?.url || `${config.evolutionBaseUrl}/message/download/${payload.key.id}`;
      console.log("Evolution audio detected:", { instance: instanceName, messageId: payload.key.id });
      
      const audio = await downloadAudio(config, mediaUrl);
      if (audio) {
        const transcribed = await transcribeAudio(audio.base64, audio.mimeType);
        if (transcribed) {
          messageText = transcribed;
          console.log("Audio transcribed (Evolution):", messageText.substring(0, 80));
        } else {
          await sendMessage(config, phone, "Desculpe, não consegui entender o áudio. Pode digitar? 😊");
          return OK({ ok: true, skipped: "audio_unreadable" });
        }
      } else {
        // Only return if we literally have no text. If it was a caption + audio (rare), we keep going.
        if (!messageText) {
          await sendMessage(config, phone, "Desculpe, não consegui processar seu áudio agora. Pode mandar por texto? 😊");
          return OK({ ok: true, skipped: "audio_download_failed" });
        }
      }
    }

    if (!messageText) return OK({ ok: true, skipped: "empty_text" });

    const normalized = normalizePhone(phone);
    const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);
    const messageKey = payload.key.id || `${normalized}_${Date.now()}`;

    // Dedup
    if (await isDuplicate(supabase, conversationId, messageKey)) return OK({ ok: true, skipped: "duplicate" });

    // Send typing indicator
    sendTyping(config, phone);

    // Gather context
    const [cliente, bh, products, history, contact] = await Promise.all([
      findCliente(supabase, phone, senderName),
      checkBusinessHours(supabase, config.unidadeId),
      getProducts(supabase, config.unidadeId, config),
      loadHistory(supabase, conversationId),
      identifyContact(supabase, phone),
    ]);
    const [recentOrders, orderStatus] = await Promise.all([
      getRecentOrders(supabase, cliente.id),
      getOrderStatus(supabase, cliente.id, normalized),
    ]);

    // Save inbound
    await saveMessage(supabase, conversationId, "user", messageText, { 
      source: "evolution-webhook", 
      message_id: messageKey,
      instance: instanceName,
      tipo_contato: contact.tipo, contato_id: contact.id || null,
    });
    await upsertConversation(supabase, conversationId, `${cliente.nome || senderName || normalized}`, normalized, config?.unidadeId || null);

    // Hard block: off-hours → fixed message, no AI
    if (bh.isOffHours) {
      const reply = getOffHoursMessage(cliente.nome, bh.horarioInfo);
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "evolution-webhook", off_hours: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true, skipped: "off_hours" });
    }

    // Debounce: wait 3s and collect any follow-up messages
    const combinedText = await collectBufferedMessages(supabase, conversationId, messageText);
    const finalMessageText = combinedText || messageText;

    // Post-order follow-up shortcut
    const postOrderResult = await isPostOrderFollowUp(supabase, normalized, finalMessageText);
    if (postOrderResult === "rating") {
      const reply = "Obrigado pela avaliação! ⭐ Sua opinião é muito importante para nós. Até a próxima! 😊";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "evolution-webhook", rating_response: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true });
    }
    if (postOrderResult === true) {
      const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 20 a 40 minutos).";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "evolution-webhook", post_order_followup: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true, skipped: "post_order_followup" });
    }

    // Rate limit check: max 10 messages per 2 hours per conversation
    const isRateLimited = await checkRateLimit(supabase, conversationId, 10, 2);
    if (isRateLimited) {
      console.warn(`Rate limited conversation ${conversationId} — skipping AI call`);
      return OK({ ok: true, skipped: "rate_limited" });
    }

    // Build prompt
    const negHint = buildNegotiationHint(history, config, finalMessageText);
    const systemPrompt = buildSystemPrompt(products, cliente, recentOrders, normalized, config, bh.isOffHours, bh.horarioInfo, orderStatus, negHint, { isSunday: bh.isSunday, waterDeliveryAllowed: bh.waterDeliveryAllowed }, history, { entrega: bh.gasDoPovoEntrega ?? false, taxa: bh.gasDoPovoTaxa ?? 15 }, contact, bh.unidadeLocation);

    // Call AI
    let reply: string;
    try {
      reply = await callAI([
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: finalMessageText },
      ]);
    } catch (e: any) {
      const fallback = e.message === "RATE_LIMIT"
        ? "Desculpe, estamos com muitas mensagens. Tente novamente! 😊"
        : "Desculpe, tive um problema técnico. Ligue para nós! 📞";
      await sendMessage(config, phone, fallback);
      return OK({ ok: true, fallback: true });
    }

    await saveMessage(supabase, conversationId, "assistant", reply);

    // Process cancellation tag
    { const cancelRes = await processCancelTagInReply(supabase, reply, cliente.id); reply = cancelRes.reply; }

    // Process order if confirmed
    const orderMatch = reply.match(/\[PEDIDO_CONFIRMADO\]([\s\S]*?)\[\/PEDIDO_CONFIRMADO\]/);
    if (orderMatch) {
      const orderData = parseOrderData(orderMatch[1]);
      if (orderData) {
        // Dedup: 2 min window
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: dup } = await supabase.from("pedidos").select("id")
          .eq("canal_venda", "whatsapp").gte("created_at", twoMinAgo)
          .ilike("observacoes", `%${normalized}%`).limit(1);

        if (dup?.length) {
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();
          reply += "\n\nSeu pedido já foi registrado! Aguarde a entrega 😊";
        } else {
          const isAgendado = bh.isOffHours || orderData.agendado === "sim";
          const { data: prevMsgs } = await supabase.from("ai_mensagens").select("content")
            .eq("conversa_id", conversationId).eq("role", "assistant")
            .order("created_at", { ascending: false }).limit(30);
          const discount = extractLatestNegotiatedDiscountPerUnit([reply, ...(prevMsgs || []).map((m: any) => m.content)]);

          const orderResult = await createOrder(supabase, orderData, cliente.id, cliente.nome, senderName, normalized, config.unidadeId, isAgendado, discount);
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();
          await registerCall(supabase, phone, cliente.id, cliente.nome, senderName, config.unidadeId, orderResult?.pedidoId);
        }
      }
    }

    // Handle location pin request
    if (reply.includes("[ENVIAR_LOCALIZACAO]")) {
      reply = reply.replace(/\[ENVIAR_LOCALIZACAO\]/g, "").trim();
      const loc = await getEntregadorLocation(supabase, cliente.id);
      if (loc) {
        await sendMessage(config, phone, reply);
        await sendLocation(config, phone, loc.lat, loc.lng, loc.nome);
        return OK({ ok: true, reply: reply.substring(0, 100), location_sent: true });
      }
    }

    await sendMessage(config, phone, reply);

    // --- AUTO FOLLOW-UP FOR NEGOTIATION (Evolution) ---
    // Only runs if auto_followup_ativo is enabled in regras_bia
    if (bh.autoFollowupAtivo) {
    const replyLower = reply.toLowerCase();
    const mentionedMgr = replyLower.includes("verificar com o gerente") || replyLower.includes("falar com o gerente") ||
      replyLower.includes("consultar o gerente") || (replyLower.includes("um momento") && !replyLower.includes("desconto"));
    const hasDiscount = replyLower.includes("desconto") && replyLower.includes("r$");

    if (mentionedMgr && !hasDiscount && config.descontoEtapa1 > 0) {
      setTimeout(async () => {
        try {
          // Race check: did user say something else in the last 4s?
          const { data: newer } = await supabase.from("ai_mensagens").select("id")
            .eq("conversa_id", conversationId).eq("role", "user")
            .gt("created_at", new Date(Date.now() - 4000).toISOString()).limit(1);
          if (newer?.length) return;

          // Dedup follow-up
          const { data: existFU } = await supabase.from("ai_mensagens").select("id")
            .eq("conversa_id", conversationId).eq("role", "assistant")
            .contains("metadata", { auto_followup_for: messageKey }).limit(1);
          if (existFU?.length) return;

          // Products for prices
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
            const lines = ["Consegui falar com o gerente novamente ✅", `Fechamos no valor mínimo: desconto total de ${fmt(config.descontoEtapa2)}/un.`];
            if (p13B) lines.push(`• P13: de ${fmt(p13B)} por ${fmt(config.precoMinimoP13 ?? p13B - config.descontoEtapa2)}`);
            if (p20B) lines.push(`• P20: de ${fmt(p20B)} por ${fmt(config.precoMinimoP20 ?? p20B - config.descontoEtapa2)}`);
            lines.push("Esse é o menor preço. Posso confirmar?");
            fu = lines.join("\n");
          } else {
            const lines = ["Consegui um desconto com o gerente ✅", `Desconto especial de ${fmt(config.descontoEtapa1)}/un.`];
            if (p13B) lines.push(`• P13: de ${fmt(p13B)} por ${fmt(p13B - config.descontoEtapa1)}`);
            if (p20B) lines.push(`• P20: de ${fmt(p20B)} por ${fmt(p20B - config.descontoEtapa1)}`);
            lines.push("Posso confirmar seu pedido?");
            fu = lines.join("\n");
          }

          await saveMessage(supabase, conversationId, "assistant", fu, { source: "evolution-webhook", auto_followup_for: messageKey });
          await sendMessage(config, phone, fu);
        } catch (err) {
          console.error("Evolution follow-up error:", err);
        }
      }, 5000);
    }
    } // end auto_followup_ativo check

    return OK({ ok: true, reply: reply.substring(0, 100) });
  } catch (error) {
    console.error("Evolution webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error", details: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
