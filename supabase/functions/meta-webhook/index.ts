// meta-webhook — BIA WhatsApp via Meta Cloud API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours, normalizePhone,
  findCliente, getRecentOrders, getOrderStatus, getProducts,
  buildSystemPrompt, buildNegotiationHint, generateUUIDFromString,
  loadHistory, saveMessage, upsertConversation, isDuplicate,
  isPostOrderFollowUp, callAI, parseOrderData, extractLatestNegotiatedDiscountPerUnit,
  createOrder, sendTyping, sendMessage, sendLocation, registerCall,
  getOffHoursMessage,
  downloadAudio, transcribeAudio, getEntregadorLocation, collectBufferedMessages,
  identifyContact,
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
    // Read the raw body so we can validate Meta's X-Hub-Signature-256 HMAC.
    const rawBody = await req.text();

    // Validate signature when META_APP_SECRET is configured.
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (appSecret) {
      const signatureHeader = req.headers.get("x-hub-signature-256") || "";
      const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : "";
      try {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(appSecret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
        const expected = Array.from(new Uint8Array(macBuf))
          .map((b) => b.toString(16).padStart(2, "0")).join("");
        // Constant-time-ish comparison
        if (provided.length !== expected.length || provided !== expected) {
          console.warn("Meta webhook: invalid X-Hub-Signature-256");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Meta webhook signature verification error:", e);
        return new Response(JSON.stringify({ error: "Signature error" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("Meta webhook: META_APP_SECRET not configured — skipping signature verification");
    }

    const body = JSON.parse(rawBody);
    console.log("Meta webhook:", JSON.stringify(body).substring(0, 500));

    // Meta sends { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== "whatsapp_business_account") return OK({ ok: true, skipped: "not_whatsapp" });

    const url = new URL(req.url);
    const queryUnidadeId = url.searchParams.get("unidade_id");

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        // ===== Status updates (sent / delivered / read / failed) =====
        if (Array.isArray(value?.statuses) && value.statuses.length) {
          for (const st of value.statuses) {
            const wamid = st?.id;
            const newStatus = st?.status; // sent, delivered, read, failed
            if (!wamid || !newStatus) continue;

            // a) Atualizar ai_mensagens pelo wa_message_id
            try {
              const update: any = { status: newStatus };
              const nowIso = new Date().toISOString();
              if (newStatus === "sent") update.sent_at = nowIso;
              else if (newStatus === "delivered") update.delivered_at = nowIso;
              else if (newStatus === "read") update.read_at = nowIso;
              else if (newStatus === "failed") update.error_message = st?.errors?.[0]?.message || "failed";

              const { data: updated } = await supabase
                .from("ai_mensagens")
                .update(update)
                .eq("wa_message_id", wamid)
                .select("id, conversa_id")
                .maybeSingle();

              if (updated) {
                const { data: conv } = await supabase
                  .from("ai_conversas").select("empresa_id, unidade_id").eq("id", updated.conversa_id).maybeSingle();
                await supabase.from("whatsapp_eventos").insert({
                  empresa_id: conv?.empresa_id || null,
                  unidade_id: conv?.unidade_id || null,
                  conversa_id: updated.conversa_id,
                  mensagem_id: updated.id,
                  wa_message_id: wamid,
                  event_type: `status_${newStatus}`,
                  event_data: { provider: "meta", errors: st?.errors || null, timestamp: st?.timestamp || null },
                });
              }
            } catch (e) {
              console.error("status update (ai_mensagens) failed for", wamid, e);
            }

            // b) Mantém compatibilidade com whatsapp_test_envios
            try {
              const { data: existing } = await supabase
                .from("whatsapp_test_envios")
                .select("id, status_history")
                .eq("wamid", wamid)
                .maybeSingle();
              if (existing) {
                const history = Array.isArray(existing.status_history) ? existing.status_history : [];
                history.push({ status: newStatus, at: new Date().toISOString(), timestamp: st?.timestamp || null, errors: st?.errors || null });
                await supabase
                  .from("whatsapp_test_envios")
                  .update({ status: newStatus, status_history: history, webhook_received_at: new Date().toISOString(), error: st?.errors?.[0]?.message || null })
                  .eq("id", existing.id);
              }
            } catch (e) {
              console.error("status update (whatsapp_test_envios) failed for", wamid, e);
            }
          }
        }

        if (!value?.messages?.length) continue;

        const metadata = value.metadata;
        const phoneNumberId = metadata?.phone_number_id;

        for (const msg of value.messages) {
          // Skip status updates (no sender or type)
          if (!msg.from || !msg.type) continue;

          // ─── COEXISTENCE LOOP PROTECTION ───────────────────────────────────
          // In Coexistence Mode, Meta echoes messages sent FROM the WhatsApp
          // Business App back to the webhook. We must ignore these echoes so
          // the BIA doesn't reply to the business owner's own messages.
          //
          // How it works:
          //  - Meta puts the CUSTOMER's phone in `msg.from` for inbound messages.
          //  - For echo messages (sent by the business app), `msg.from` contains
          //    the BUSINESS phone number itself.
          //  - We compare the last 10 digits of `msg.from` with the registered
          //    business number's last 10 digits (554335241094 → 4335241094).
          //  - We also skip `system` type messages (Meta internal notifications).
          if (msg.type === "system") {
            console.log("Meta: skipping system/internal message (coexistence)");
            continue;
          }
          // Known business phone number digits (last 10 of +55 43 3524-1094)
          const BUSINESS_PHONE_LAST10 = "4335241094";
          const senderLast10 = (msg.from || "").replace(/\D/g, "").slice(-10);
          if (senderLast10 === BUSINESS_PHONE_LAST10) {
            console.log("Meta: skipping echo from business number (coexistence protection):", msg.from);
            continue;
          }
          // ─── END COEXISTENCE LOOP PROTECTION ───────────────────────────────

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
          await saveMessage(supabase, conversationId, "user", messageText, { source: "meta-webhook", message_id: messageId, tipo_contato: contact.tipo, contato_id: contact.id || null });
          await upsertConversation(supabase, conversationId, `${cliente.nome || senderName || normalized}`, normalized, config?.unidadeId || null);

          // Hard block: off-hours → fixed message, no AI
          if (bh.isOffHours) {
            const reply = getOffHoursMessage(cliente.nome, bh.horarioInfo);
            await saveMessage(supabase, conversationId, "assistant", reply, { source: "meta-webhook", off_hours: true });
            await sendMessage(config, phone, reply);
            continue;
          }

          // Debounce: wait 3s and collect any follow-up messages
          const { text: combinedText, isLatest } = await collectBufferedMessages(supabase, conversationId, messageText, messageId);
          if (!isLatest) {
            console.log("Meta: message not latest, skipping (debounced). ID:", messageId);
            continue;
          }
          const finalMessageText = combinedText || messageText;

          // Post-order shortcut
          const postOrderResult = await isPostOrderFollowUp(supabase, normalized, finalMessageText);
          if (postOrderResult === "rating") {
            const reply = "Obrigado pela avaliação! ⭐ Sua opinião é muito importante para nós. Até a próxima! 😊";
            await saveMessage(supabase, conversationId, "assistant", reply, { source: "meta-webhook", rating_response: true });
            await sendMessage(config, phone, reply);
            continue;
          }
          if (postOrderResult === true) {
            const reply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 20 a 40 minutos).";
            await saveMessage(supabase, conversationId, "assistant", reply, { source: "meta-webhook", post_order_followup: true });
            await sendMessage(config, phone, reply);
            continue;
          }

          // Build AI prompt
          const negHint = buildNegotiationHint(history, config, finalMessageText);
          const systemPrompt = buildSystemPrompt(products, cliente, recentOrders, normalized, config, bh.isOffHours, bh.horarioInfo, orderStatus, negHint, { isSunday: bh.isSunday, waterDeliveryAllowed: bh.waterDeliveryAllowed }, history, { entrega: bh.gasDoPovoEntrega ?? false, taxa: bh.gasDoPovoTaxa ?? 15 }, contact);

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
            continue;
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
                const orderResult = await createOrder(supabase, orderData, cliente.id, cliente.nome, senderName, normalized, config.unidadeId, isAgendado, discount);
                await registerCall(supabase, phone, cliente.id, cliente.nome, senderName, config.unidadeId, orderResult?.pedidoId);
              }
            }
          }

          // Handle location sharing
          if (reply.includes("[ENVIAR_LOCALIZACAO]")) {
            reply = reply.replace(/\[ENVIAR_LOCALIZACAO\]/g, "").trim();
            const loc = await getEntregadorLocation(supabase, cliente.id);
            if (loc) {
              const cleanReply = reply.replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, "").trim();
              await sendMessage(config, phone, cleanReply);
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

          const finalCleanReply = reply.replace(/\[STATE\][\s\S]*?\[\/STATE\]/gi, "").trim();
          await sendMessage(config, phone, finalCleanReply);
        }
      }
    }

    return OK({ ok: true });
  } catch (error) {
    console.error("Meta webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
