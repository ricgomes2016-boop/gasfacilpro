// uazapi-webhook — BIA WhatsApp via UaZapi (thin wrapper over bia-core)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, sendLocation, registerCall,
  downloadAudio, transcribeAudio, getEntregadorLocation, collectBufferedMessages, getOffHoursMessage,
  identifyContact, processCancelTagInReply, stripPedidoConfirmadoBlock,
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
    const rawBody = await req.json();
    console.log("UaZapi webhook raw:", JSON.stringify(rawBody).substring(0, 500));

    // UaZapi wraps payloads in a container with EventType, message, chat, etc.
    // Normalize: if rawBody has EventType "messages" and a nested message object, extract it
    let body = rawBody;
    const isUaZapiWrapped = !!rawBody.EventType;
    
    if (isUaZapiWrapped) {
      console.log("UaZapi wrapped payload detected. EventType:", rawBody.EventType, "Keys:", Object.keys(rawBody).join(","));
      
      // Only process message events
      if (rawBody.EventType !== "messages") {
        return OK({ ok: true, skipped: "not_message_event", eventType: rawBody.EventType });
      }
      
      // UaZapi nests the actual message data in "message"
      const msg = rawBody.message || rawBody.msg || rawBody;
      
      // UaZapi uses chatid for the real phone (e.g. "554399692765@s.whatsapp.net")
      // sender_pn has the phone number, chatlid is a LID (not usable)
      const realPhone = msg.chatid || msg.sender_pn || msg.sender || msg.from || msg.phone || rawBody.from || "";
      const msgText = msg.text || (typeof msg.content === "string" ? msg.content : msg.content?.text) || msg.body || "";
      
      console.log("UaZapi extracted: phone=", realPhone, "text=", msgText?.substring(0, 80), "fromMe=", msg.fromMe, "wasSentByApi=", msg.wasSentByApi);
      
      // Build a normalized body from UaZapi format
      body = {
        ...msg,
        from: realPhone,
        fromMe: msg.fromMe ?? rawBody.fromMe ?? false,
        text: msgText,
        type: msg.type || "chat",
        senderName: msg.senderName || msg.pushName || rawBody.chat?.name || rawBody.instanceName || "",
        isGroup: msg.isGroup ?? (realPhone && realPhone.includes("@g.us")) ?? false,
        isNewMsg: true,
        id: msg.id || msg.messageid || msg.messageId || rawBody.id || "",
        audioMessage: msg.audioMessage || null,
        mediaUrl: msg.mediaUrl || msg.audio || null,
      };
      
      // Also skip messages sent by the API (own bot replies)
      if (msg.wasSentByApi === true) return OK({ ok: true, skipped: "wasSentByApi" });
      
      console.log("UaZapi normalized:", JSON.stringify({ from: body.from, text: body.text?.substring(0, 80), type: body.type, fromMe: body.fromMe, senderName: body.senderName }));
    }

    // Skip own messages
    if (body.fromMe === true || body.direction === "sent") return OK({ ok: true, skipped: "fromMe" });

    // Check for audio
    const isAudio = body.type === "audio" || body.type === "ptt" || body.isAudio === true || !!body.audioMessage;
    if (!isAudio && !(body.cmd === "chat" || body.type === "chat" || body.isNewMsg === true)) return OK({ ok: true, skipped: "not_message" });

    const phone = body.from || body.phone || body.sender || "";
    let messageText = body.text || body.body || body.content || "";
    const senderName = body.senderName || body.pushName || body.chatName || "";
    const isGroup = body.isGroup === true || (phone && phone.includes("@g.us"));
    const audioUrl = body.audioMessage?.url || body.mediaUrl || body.audio || null;
    if (isGroup || !phone) return OK({ ok: true, skipped: "invalid" });

    // Handle audio messages
    if (isAudio || (audioUrl && typeof audioUrl === "string" && !messageText)) {
      const url0 = new URL(req.url);
      const cfg0 = await resolveConfig(supabase, "uazapi", url0.searchParams.get("unidade_id"), null);
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
    const config = await resolveConfig(supabase, "uazapi", url.searchParams.get("unidade_id"), null);
    if (!config) throw new Error("UaZapi credentials not configured");

    // Enforce token auth (defense against fake inbound messages).
    // UaZapi forwards the instance token in headers; require it to match the configured token.
    const incomingToken =
      req.headers.get("token") ||
      req.headers.get("apikey") ||
      req.headers.get("x-api-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      url.searchParams.get("token") ||
      "";
    const expectedToken = (config as any).securityToken || (config as any).token;
    if (expectedToken && incomingToken !== expectedToken) {
      console.warn("UaZapi webhook: invalid or missing token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizePhone(phone);
    const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);
    const messageKey = body.id || body.messageId || `${normalized}_${Date.now()}_${messageText.trim().toLowerCase().slice(0, 30)}`;

    // Dedup
    if (await isDuplicate(supabase, conversationId, messageKey)) return OK({ ok: true, skipped: "duplicate" });

    // Send typing immediately
    sendTyping(config, phone);

    // Gather context in parallel
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

    // Keep the conversation scoped before the message insert so realtime
    // notification triggers can resolve empresa/unidade on the first message.
    await upsertConversation(supabase, conversationId, `WhatsApp: ${cliente.nome || senderName || normalized}`, normalized, config?.unidadeId || null);
    await saveMessage(supabase, conversationId, "user", messageText, { source: "uazapi-webhook", message_id: messageKey, tipo_contato: contact.tipo, contato_id: contact.id || null });

    // Hard block: off-hours → fixed message, no AI
    if (bh.isOffHours) {
      const reply = getOffHoursMessage(cliente.nome, bh.horarioInfo);
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "uazapi-webhook", off_hours: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true, skipped: "off_hours" });
    }

    // Debounce: wait 3s and collect any follow-up messages
    const { text: combinedText, isLatest } = await collectBufferedMessages(supabase, conversationId, messageText, messageKey);
    if (!isLatest) {
      return OK({ ok: true, skipped: "debounce_waiting" });
    }
    const finalMessageText = combinedText || messageText;

    // Post-order shortcut
    const postOrderResult = await isPostOrderFollowUp(supabase, normalized, finalMessageText);
    if (postOrderResult === "rating") {
      const reply = "Obrigado pela avaliação! ⭐ Sua opinião é muito importante para nós. Até a próxima! 😊";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "uazapi-webhook", rating_response: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true });
    }
    if (postOrderResult === true) {
      const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 20 a 40 minutos).";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "uazapi-webhook", post_order_followup: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true, skipped: "post_order_followup" });
    }

    // Build AI prompt
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

          await createOrder(supabase, orderData, cliente.id, cliente.nome, senderName, normalized, config.unidadeId, isAgendado, discount);
        }
      }
      await registerCall(supabase, phone, cliente.id, cliente.nome, senderName, config.unidadeId);
    }

    // Handle location sharing
    if (reply.includes("[ENVIAR_LOCALIZACAO]")) {
      reply = reply.replace(/\[ENVIAR_LOCALIZACAO\]/g, "").trim();
      const loc = await getEntregadorLocation(supabase, cliente.id);
      if (loc) {
        const cleanReply = reply.replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, "").trim();
        await sendMessage(config, phone, cleanReply);
        await sendLocation(config, phone, loc.lat, loc.lng, loc.nome);
        return OK({ ok: true, reply: reply.substring(0, 100), location_sent: true });
      }
    }

    const finalCleanReply = reply.replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, "").trim();
    await sendMessage(config, phone, finalCleanReply);
    return OK({ ok: true, reply: reply.substring(0, 100) });
  } catch (error) {
    console.error("UaZapi webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
