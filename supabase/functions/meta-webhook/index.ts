// meta-webhook — BIA WhatsApp via Meta Cloud API
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const OK = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  // Meta webhook verification (GET with hub.challenge)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      // Try to verify against stored token
      const supabase = createSupabase();
      const unidadeId = url.searchParams.get("unidade_id");

      let verifyToken = "gasfacil_meta_verify";
      if (unidadeId) {
        const { data } = await supabase.from("integracoes_whatsapp")
          .select("meta_verify_token").eq("unidade_id", unidadeId).eq("provedor", "meta").eq("ativo", true).maybeSingle();
        if (data?.meta_verify_token) verifyToken = data.meta_verify_token;
      }

      if (token === verifyToken) {
        console.log("Meta webhook verified for unidade:", unidadeId);
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("OK", { status: 200 });
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createSupabase();
    const body = await req.json();
    console.log("Meta webhook:", JSON.stringify(body).substring(0, 500));

    // Meta sends { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== "whatsapp_business_account") return OK({ ok: true, skipped: "not_whatsapp" });

    const url = new URL(req.url);
    const queryUnidadeId = url.searchParams.get("unidade_id");

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        if (!value?.messages?.length) continue;

        const metadata = value.metadata;
        const phoneNumberId = metadata?.phone_number_id;

        for (const msg of value.messages) {
          // Skip status updates
          if (!msg.from || !msg.type) continue;

          const phone = msg.from; // Already in international format without +
          const senderName = value.contacts?.[0]?.profile?.name || "";
          const messageId = msg.id || `meta_${phone}_${Date.now()}`;

          // Extract message text
          let messageText = "";
          let audioUrl: string | null = null;
          let isAudio = false;

          if (msg.type === "text") {
            messageText = msg.text?.body || "";
          } else if (msg.type === "audio") {
            isAudio = true;
            audioUrl = msg.audio?.id || null; // Meta uses media IDs, not URLs
          } else if (msg.type === "interactive") {
            messageText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
          } else if (msg.type === "image" && msg.image?.caption) {
            messageText = msg.image.caption;
          } else {
            console.log("Meta: skipping message type:", msg.type);
            continue;
          }

          // Resolve config
          const config = await resolveConfig(supabase, "meta", queryUnidadeId, phoneNumberId);
          if (!config) {
            console.error("Meta config not found for phone_number_id:", phoneNumberId);
            continue;
          }

          // Handle audio: download from Meta Graph API then transcribe
          if (isAudio && audioUrl) {
            // Get media URL from Meta
            const mediaResp = await fetch(`https://graph.facebook.com/v21.0/${audioUrl}`, {
              headers: { "Authorization": `Bearer ${config.token}` },
            });
            if (mediaResp.ok) {
              const mediaData = await mediaResp.json();
              if (mediaData.url) {
                const audio = await downloadAudio(config, mediaData.url);
                if (audio) {
                  const transcribed = await transcribeAudio(audio.base64, audio.mimeType);
                  if (transcribed) {
                    messageText = transcribed;
                    console.log("Meta audio transcribed:", messageText.substring(0, 80));
                  } else {
                    await sendMessage(config, phone, "Desculpe, não consegui entender o áudio. Pode digitar? 😊");
                    continue;
                  }
                }
              }
            }
          }

          if (!messageText) continue;

          const normalized = normalizePhone(phone);
          const conversationId = await generateUUIDFromString(`whatsapp_${normalized}`);

          // Dedup
          if (await isDuplicate(supabase, conversationId, messageId)) continue;

          // Send typing (no-op for Meta but keeps consistency)
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
          await saveMessage(supabase, conversationId, "user", messageText, { source: "meta-webhook", message_id: messageId });
          await upsertConversation(supabase, conversationId, `WhatsApp: ${cliente.nome || senderName || normalized}`);

          // Post-order shortcut
          if (await isPostOrderFollowUp(supabase, normalized, messageText)) {
            const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 30 a 60 minutos).";
            await saveMessage(supabase, conversationId, "assistant", reply, { source: "meta-webhook", post_order_followup: true });
            await sendMessage(config, phone, reply);
            continue;
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
            continue;
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
              continue;
            }
          }

          // Mark message as read
          try {
            await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.token}` },
              body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
            });
          } catch (_) {}

          await sendMessage(config, phone, reply);
        }
      }
    }

    return OK({ ok: true });
  } catch (error) {
    console.error("Meta webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
