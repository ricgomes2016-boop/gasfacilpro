// gateway-webhook — BIA WhatsApp via Gateway (Baileys/Evolution API)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, sendLocation, registerCall,
  getEntregadorLocation,
} from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};
const OK = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createSupabase();
    const body = await req.json();
    console.log("Gateway webhook:", JSON.stringify(body).substring(0, 500));

    // Expected payload from whatsapp-gateway-api webhook forward:
    // { instance, instance_id, phone, name, message, timestamp, raw }
    const instanceName = body.instance;
    const phone = body.phone;
    const messageText = body.message;
    const senderName = body.name || "";
    const messageId = body.raw?.data?.key?.id || `gw_${phone}_${Date.now()}`;

    if (!instanceName || !phone || !messageText) {
      console.log("Gateway webhook: missing required fields");
      return OK({ ok: true, skipped: "missing_fields" });
    }

    // Resolve config from gateway instance
    const config = await resolveConfig(supabase, "gateway", null, instanceName);
    if (!config) {
      console.error("Gateway config not found for instance:", instanceName);
      return OK({ ok: true, skipped: "config_not_found" });
    }

    const normalized = normalizePhone(phone);
    const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);

    // Dedup
    if (await isDuplicate(supabase, conversationId, messageId)) {
      return OK({ ok: true, skipped: "duplicate" });
    }

    // Send typing
    sendTyping(config, phone);

    // Gather context
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
    await saveMessage(supabase, conversationId, "user", messageText, { source: "gateway-webhook", message_id: messageId, instance: instanceName });
    await upsertConversation(supabase, conversationId, `WhatsApp: ${cliente.nome || senderName || normalized}`);

    // Post-order shortcut
    if (await isPostOrderFollowUp(supabase, normalized, messageText)) {
      const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 30 a 60 minutos).";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "gateway-webhook", post_order_followup: true });
      await sendMessage(config, phone, reply);
      return OK({ ok: true });
    }

    // Build AI prompt
    const negHint = buildNegotiationHint(history, config, messageText);
    const systemPrompt = buildSystemPrompt(products, cliente, recentOrders, normalized, config, bh.isOffHours, bh.horarioInfo, orderStatus, negHint);

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
      return OK({ ok: true });
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
        return OK({ ok: true });
      }
    }

    await sendMessage(config, phone, reply);
    return OK({ ok: true });
  } catch (error) {
    console.error("Gateway webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
