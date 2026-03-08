// zapi-webhook — BIA WhatsApp via Z-API (thin wrapper over bia-core)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, registerCall,
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
    console.log("Z-API webhook:", JSON.stringify(body).substring(0, 500));

    // Skip own messages and non-messages
    if (body.fromMe === true) return OK({ ok: true, skipped: "fromMe" });
    if (!(body.type === "ReceivedCallback" || body.isNewMsg === true)) return OK({ ok: true, skipped: "not_message" });

    const phone = body.phone || body.from || "";
    const messageText = body.text?.message || body.body || body.text || "";
    const senderName = body.senderName || body.chatName || "";
    if (body.isGroup === true || !phone || !messageText) return OK({ ok: true, skipped: "invalid" });

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

    const normalized = normalizePhone(phone);
    const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);
    const messageKey = body.messageId ? String(body.messageId) : `${normalized}_${body.momment || ""}_${messageText.trim().toLowerCase()}`;

    // Dedup
    if (await isDuplicate(supabase, conversationId, messageKey)) return OK({ ok: true, skipped: "duplicate" });

    // Send typing indicator immediately
    sendTyping(finalConfig, phone);

    // Gather context
    const [cliente, bh, products, history] = await Promise.all([
      findCliente(supabase, phone),
      checkBusinessHours(supabase, finalConfig.unidadeId),
      getProducts(supabase, finalConfig.unidadeId),
      loadHistory(supabase, conversationId),
    ]);
    const [recentOrders, orderStatus] = await Promise.all([
      getRecentOrders(supabase, cliente.id),
      getOrderStatus(supabase, cliente.id, normalized),
    ]);

    // Save inbound + upsert conversation
    await saveMessage(supabase, conversationId, "user", messageText, {
      source: "zapi-webhook", message_id: messageKey,
      raw_message_id: body.messageId ?? null, moment: body.momment ?? null,
    });
    await upsertConversation(supabase, conversationId, `WhatsApp: ${cliente.nome || senderName || normalized}`);

    // Post-order follow-up shortcut
    if (await isPostOrderFollowUp(supabase, normalized, messageText)) {
      const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 30 a 60 minutos).";
      await saveMessage(supabase, conversationId, "assistant", reply, { source: "zapi-webhook", post_order_followup: true });
      await sendMessage(finalConfig, phone, reply);
      return OK({ ok: true, skipped: "post_order_followup" });
    }

    // Build prompt with negotiation hint
    const negHint = buildNegotiationHint(history, finalConfig, messageText);
    const systemPrompt = buildSystemPrompt(products, cliente, recentOrders, normalized, finalConfig, bh.isOffHours, bh.horarioInfo, orderStatus, negHint);

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

    await saveMessage(supabase, conversationId, "assistant", reply);

    // Process order
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

          await createOrder(supabase, orderData, cliente.id, cliente.nome, senderName, normalized, finalConfig.unidadeId, isAgendado, discount);
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();
        }
      }
      await registerCall(supabase, phone, cliente.id, cliente.nome, senderName, finalConfig.unidadeId);
    }

    await sendMessage(finalConfig, phone, reply);

    // Auto follow-up for negotiation (same logic as before, using deterministic discount)
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

    return OK({ ok: true, reply: reply.substring(0, 100) });
  } catch (error) {
    console.error("Z-API webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
