// uazapi-webhook — BIA WhatsApp via UaZapi (thin wrapper over bia-core)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, sendLocation, registerCall,
  downloadAudio, transcribeAudio, getEntregadorLocation,
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

    const normalized = normalizePhone(phone);
    const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);
    const messageKey = body.id || body.messageId || `${normalized}_${Date.now()}_${messageText.trim().toLowerCase().slice(0, 30)}`;

    // Dedup
    if (await isDuplicate(supabase, conversationId, messageKey)) return OK({ ok: true, skipped: "duplicate" });

    // Send typing immediately
    sendTyping(config, phone);

    // Gather context in parallel
    const [cliente, bh, products, history] = await Promise.all([
      findCliente(supabase, phone),
      checkBusinessHours(supabase, config.unidadeId),
      getProducts(supabase, config.unidadeId),
      loadHistory(supabase, conversationId),
    ]);
    const [recentOrders, orderStatus] = await Promise.all([
      getRecentOrders(supabase, cliente.id),
      getOrderStatus(supabase, cliente.id, normalized),
    ]);

    // Save inbound
    await saveMessage(supabase, conversationId, "user", messageText, { source: "uazapi-webhook", message_id: messageKey });
    await upsertConversation(supabase, conversationId, `WhatsApp: ${cliente.nome || senderName || normalized}`);

    // Post-order shortcut
    if (await isPostOrderFollowUp(supabase, normalized, messageText)) {
      const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 30 a 60 minutos).";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "uazapi-webhook", post_order_followup: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true, skipped: "post_order_followup" });
    }

    // Build AI prompt
    const negHint = buildNegotiationHint(history, config, messageText);
    const systemPrompt = buildSystemPrompt(products, cliente, recentOrders, normalized, config, bh.isOffHours, bh.horarioInfo, orderStatus, negHint);

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
      await sendMessage(config, phone, fallback);
      return OK({ ok: true, fallback: true });
    }

    await saveMessage(supabase, conversationId, "assistant", reply);

    // Process order
    const orderMatch = reply.match(/\[PEDIDO_CONFIRMADO\]([\s\S]*?)\[\/PEDIDO_CONFIRMADO\]/);
    if (orderMatch) {
      const orderData = parseOrderData(orderMatch[1]);
      if (orderData) {
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

          await createOrder(supabase, orderData, cliente.id, cliente.nome, senderName, normalized, config.unidadeId, isAgendado, discount);
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();
        }
      }
      await registerCall(supabase, phone, cliente.id, cliente.nome, senderName, config.unidadeId);
    }

    // Handle location sharing
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
    return OK({ ok: true, reply: reply.substring(0, 100) });
  } catch (error) {
    console.error("UaZapi webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
