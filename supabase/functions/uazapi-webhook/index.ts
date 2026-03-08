// uazapi-webhook — BIA WhatsApp via UaZapi (thin wrapper over bia-core)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, registerCall,
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
    console.log("UaZapi webhook:", JSON.stringify(body).substring(0, 500));

    // Skip own messages
    if (body.fromMe === true || body.direction === "sent") return OK({ ok: true, skipped: "fromMe" });

    // Only process chat messages
    if (!(body.cmd === "chat" || body.type === "chat" || body.isNewMsg === true)) return OK({ ok: true, skipped: "not_message" });

    const phone = body.from || body.phone || body.sender || "";
    const messageText = body.text || body.body || body.content || "";
    const senderName = body.senderName || body.pushName || body.chatName || "";
    const isGroup = body.isGroup === true || (phone && phone.includes("@g.us"));
    if (isGroup || !phone || !messageText) return OK({ ok: true, skipped: "invalid" });

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

    await sendMessage(config, phone, reply);
    return OK({ ok: true, reply: reply.substring(0, 100) });
  } catch (error) {
    console.error("UaZapi webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
