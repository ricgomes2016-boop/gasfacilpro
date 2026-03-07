import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const body = await req.json();
    console.log("Z-API webhook received:", JSON.stringify(body).substring(0, 500));

    // Skip messages sent by the bot itself
    if (body.fromMe === true) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMessage = body.type === "ReceivedCallback" || body.isNewMsg === true;
    if (!isMessage) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = body.phone || body.from || "";
    const messageText = body.text?.message || body.body || body.text || "";
    const senderName = body.senderName || body.chatName || "";
    const isGroup = body.isGroup === true;

    if (isGroup || !phone || !messageText) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve credentials: try per-unit DB config first, then fall back to env secrets
    const url = new URL(req.url);
    const queryUnidadeId = url.searchParams.get("unidade_id");
    const payloadInstanceId = body.instanceId || body.instance_id || null;

    let ZAPI_INSTANCE_ID: string | null = null;
    let ZAPI_TOKEN: string | null = null;
    let ZAPI_SECURITY_TOKEN: string | null = null;
    let resolvedUnidadeId: string | null = null;

    let descontoEtapa1 = 5;
    let descontoEtapa2 = 10;
    let precoMinimoP13: number | null = null;
    let precoMinimoP20: number | null = null;

    // Strategy 1: lookup by unidade_id query param
    if (queryUnidadeId) {
      const { data: config } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("unidade_id", queryUnidadeId)
        .eq("ativo", true)
        .maybeSingle();

      if (config) {
        ZAPI_INSTANCE_ID = config.instance_id;
        ZAPI_TOKEN = config.token;
        ZAPI_SECURITY_TOKEN = config.security_token;
        resolvedUnidadeId = config.unidade_id;
        descontoEtapa1 = config.desconto_etapa1 ?? 5;
        descontoEtapa2 = config.desconto_etapa2 ?? 10;
        precoMinimoP13 = config.preco_minimo_p13 ?? null;
        precoMinimoP20 = config.preco_minimo_p20 ?? null;
      }
    }

    // Strategy 2: lookup by instanceId from payload
    if (!ZAPI_INSTANCE_ID && payloadInstanceId) {
      const { data: config } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("instance_id", payloadInstanceId)
        .eq("ativo", true)
        .maybeSingle();

      if (config) {
        ZAPI_INSTANCE_ID = config.instance_id;
        ZAPI_TOKEN = config.token;
        ZAPI_SECURITY_TOKEN = config.security_token;
        resolvedUnidadeId = config.unidade_id;
        descontoEtapa1 = config.desconto_etapa1 ?? 5;
        descontoEtapa2 = config.desconto_etapa2 ?? 10;
        precoMinimoP13 = config.preco_minimo_p13 ?? null;
        precoMinimoP20 = config.preco_minimo_p20 ?? null;
      }
    }

    // Strategy 3: fallback only for true single-unit setups
    if (!ZAPI_INSTANCE_ID) {
      const { data: configs } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("ativo", true)
        .limit(2);

      if (configs && configs.length === 1) {
        ZAPI_INSTANCE_ID = configs[0].instance_id;
        ZAPI_TOKEN = configs[0].token;
        ZAPI_SECURITY_TOKEN = configs[0].security_token;
        resolvedUnidadeId = configs[0].unidade_id;
        descontoEtapa1 = configs[0].desconto_etapa1 ?? 5;
        descontoEtapa2 = configs[0].desconto_etapa2 ?? 10;
        precoMinimoP13 = configs[0].preco_minimo_p13 ?? null;
        precoMinimoP20 = configs[0].preco_minimo_p20 ?? null;
      } else if (configs && configs.length > 1) {
        console.warn("Multiple active WhatsApp integrations found; skipping generic fallback. Resolve by instance_id/unidade_id.");
      }
    }

    // Strategy 4: fall back to env secrets (legacy)
    if (!ZAPI_INSTANCE_ID) {
      ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID") || null;
      ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") || null;
      ZAPI_SECURITY_TOKEN = Deno.env.get("ZAPI_SECURITY_TOKEN") || null;
    }

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      throw new Error("Z-API credentials not configured");
    }

    // Check business hours
    let isOffHours = false;
    let horarioInfo = "";
    if (resolvedUnidadeId) {
      const { data: unidadeConfig } = await supabase
        .from("unidades")
        .select("horario_abertura, horario_fechamento, nome")
        .eq("id", resolvedUnidadeId)
        .maybeSingle();

      if (unidadeConfig?.horario_abertura && unidadeConfig?.horario_fechamento) {
        const now = new Date();
        const brasiliaOffset = -3 * 60;
        const localTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
        const currentTime = String(localTime.getHours()).padStart(2, '0') + ":" + String(localTime.getMinutes()).padStart(2, '0');

        const abertura = unidadeConfig.horario_abertura;
        const fechamento = unidadeConfig.horario_fechamento;
        horarioInfo = "das " + abertura + " às " + fechamento;

        if (currentTime < abertura || currentTime >= fechamento) {
          isOffHours = true;
        }
      }
    }

    // Normalize phone
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.slice(-11);
    const searchPatterns = [normalized, normalized.slice(-10)];

    // Find client
    let clienteId: string | null = null;
    let clienteNome: string | null = null;
    let clienteEndereco: string | null = null;

    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, telefone, endereco, bairro, numero")
      .or(searchPatterns.map((p) => `telefone.ilike.%${p}%`).join(","))
      .limit(1);

    if (clientes && clientes.length > 0) {
      clienteId = clientes[0].id;
      clienteNome = clientes[0].nome;
      clienteEndereco = [clientes[0].endereco, clientes[0].numero, clientes[0].bairro]
        .filter(Boolean)
        .join(", ");
    }

    // Recent orders
    let recentOrders = "";
    if (clienteId) {
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, valor_total, status, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (pedidos && pedidos.length > 0) {
        recentOrders = pedidos
          .map((p: any) => `- Pedido ${p.id.slice(0, 8)}: R$${p.valor_total} (${p.status})`)
          .join("\n");
      }
    }

    // Products (filter by unidade if resolved)
    let prodQuery = supabase
      .from("produtos")
      .select("nome, preco, estoque")
      .eq("ativo", true)
      .gt("estoque", 0)
      .order("nome")
      .limit(15);

    if (resolvedUnidadeId) {
      prodQuery = prodQuery.or(`unidade_id.eq.${resolvedUnidadeId},unidade_id.is.null`);
    }

    const { data: produtos } = await prodQuery;

    const productList = produtos
      ? produtos.map((p: any) => `- ${p.nome}: R$${Number(p.preco).toFixed(2)}`).join("\n")
      : "Produtos indisponíveis no momento.";

    // AI prompt
    const systemPrompt = `Você é a Bia, atendente real da empresa pelo WhatsApp. Você é uma pessoa, NÃO um robô ou IA. NUNCA diga que é inteligência artificial, assistente virtual, bot ou qualquer coisa do tipo. Se perguntarem, diga que é a Bia, atendente da empresa.

ESTILO DE COMUNICAÇÃO (MUITO IMPORTANTE):
- Mensagens CURTAS e RÁPIDAS, como uma atendente humana digitando no celular.
- Máximo 2-3 linhas por mensagem. Nada de textão.
- Tom natural e simpático. Use "😊" ou "✅" com moderação (máximo 1 por mensagem).
- Exemplos de tom: "Oi! Vai querer o de sempre?", "Anotado! Entrega em 30-60 min", "Pix ou dinheiro?"
- NÃO use linguagem formal demais. Seja direta e amigável.
- NÃO pergunte sobre troco. NUNCA. Nem sugira. Ignore completamente o assunto troco.
- NÃO faça despedidas longas. Um "Qualquer coisa me chama! 😊" basta.
- NUNCA use "tanque de gás". Diga apenas "gás", "botijão" ou o nome do produto (P13, P20, P45). Somos uma revenda de gás, não de tanques.

PRODUTOS DISPONÍVEIS:
${productList}

${clienteNome ? `CLIENTE: ${clienteNome}` : "CLIENTE NOVO"}
${clienteEndereco ? `ENDEREÇO: ${clienteEndereco}` : ""}
${recentOrders ? `ÚLTIMOS PEDIDOS:\n${recentOrders}` : ""}

REGRAS:
- Se o cliente já tem cadastro com endereço, confirme rapidamente: "Entrego no endereço de sempre?"
- Se já informou dados na conversa, NÃO peça de novo.
- Para clientes recorrentes, seja ainda mais direta: "Oi [nome]! O de sempre? 😊"

FLUXO DO PEDIDO (seja rápida):
1. Precisa de: produto, quantidade, endereço e pagamento.
2. Cliente novo: pedir nome também.
3. Peça SÓ o que falta. Se falta só pagamento, pergunte só isso.
4. Quando tiver tudo, finalize com:
   [PEDIDO_CONFIRMADO]
   nome: Nome
   produto: Produto
   quantidade: X
   endereco: Endereço
   pagamento: forma
   [/PEDIDO_CONFIRMADO]
5. Prazo: 30 a 60 minutos.
6. NÃO invente preços. Use APENAS os listados.

NEGOCIAÇÃO DE PREÇO (TRÊS ETAPAS):
- ETAPA 1: Cliente reclama do preço → "Deixa eu ver com o gerente, um momento!"
- ETAPA 2: Próxima mensagem dele → Retorne com desconto de R$ ${descontoEtapa1.toFixed(2)}/un para P13/P20. Diga preço original e final.
- ETAPA 3: Pede mais desconto → "Vou tentar de novo..." → Próxima msg: desconto TOTAL R$ ${descontoEtapa2.toFixed(2)}/un${precoMinimoP13 ? ` (P13 mínimo: R$ ${precoMinimoP13.toFixed(2)})` : ''}${precoMinimoP20 ? ` (P20 mínimo: R$ ${precoMinimoP20.toFixed(2)})` : ''}. Esse é o mínimo.
- NUNCA dê desconto e "vou verificar" na MESMA mensagem.
- Outros produtos (P45, Água): preço já é o melhor, sem desconto.
- CÁLCULO: campo "desconto" = desconto por unidade × quantidade. Se etapa 2: ${descontoEtapa1.toFixed(2)} × qtd. Se etapa 3: ${descontoEtapa2.toFixed(2)} × qtd.
- Inclua [PEDIDO_CONFIRMADO] apenas UMA VEZ por conversa.
${isOffHours ? `
FORA DO HORÁRIO (${horarioInfo}):
- "Estamos fechados agora, mas posso agendar pra quando abrirmos! Quer?"
- Se sim, colete dados e adicione "agendado: sim" no bloco.
` : ''}
EXEMPLO COM DESCONTO:
[PEDIDO_CONFIRMADO]
nome: João
produto: Gás P13
quantidade: 1
endereco: Rua X, 123
pagamento: pix
desconto: ${descontoEtapa2.toFixed(2)}
[/PEDIDO_CONFIRMADO]`;

    const conversationUUID = await generateUUIDFromString(`whatsapp_${normalized}`);
    const incomingMessageKey = body.messageId
      ? String(body.messageId)
      : `${normalized}_${String(body.momment || "")}_${messageText.trim().toLowerCase()}`;

    // Idempotency guard: skip duplicated inbound webhook events
    const { data: duplicatedEvent } = await supabase
      .from("ai_mensagens")
      .select("id")
      .eq("conversa_id", conversationUUID)
      .eq("role", "user")
      .contains("metadata", { message_id: incomingMessageKey })
      .limit(1);

    if (duplicatedEvent && duplicatedEvent.length > 0) {
      console.log("Duplicate inbound event skipped:", incomingMessageKey);
      return new Response(JSON.stringify({ ok: true, skipped: "duplicate_event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: historyRows } = await supabase
      .from("ai_mensagens")
      .select("role, content, created_at")
      .eq("conversa_id", conversationUUID)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = historyRows
      ? historyRows.map((m: any) => ({ role: m.role, content: m.content }))
      : [];

    const normalizedUserMsg = messageText.trim().toLowerCase();
    const looksLikeNewOrderIntent = /(quero|preciso|novo pedido|pedido|gás|gas|botij|p13|p20|p45|água|agua|comprar|entrega)/i.test(messageText);
    const isPostOrderFollowUp = /(obrigad|valeu|ok|não|nao|sim|certo|perfeito|show|blz|beleza|não preciso|nao preciso|sem troco|troco)/i.test(normalizedUserMsg);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentWhatsappOrders } = await supabase
      .from("pedidos")
      .select("id, created_at")
      .eq("canal_venda", "whatsapp")
      .gte("created_at", twoHoursAgo)
      .ilike("observacoes", `%(${normalized})%`)
      .order("created_at", { ascending: false })
      .limit(1);

    const hasRecentWhatsappOrder = !!(recentWhatsappOrders && recentWhatsappOrders.length > 0);

    // Detect negotiation state from ALL assistant messages
    let negotiationHint = "";
    if (history.length > 0) {
      const allAssistantMsgs = history.filter((m: any) => m.role === "assistant");
      
      if (allAssistantMsgs.length > 0) {
        const lastAssistantMsg = allAssistantMsgs[allAssistantMsgs.length - 1].content.toLowerCase();
        
        // Check if last message mentioned manager (pending follow-up)
        const lastMentionsManager = lastAssistantMsg.includes("verificar com o gerente") || 
          lastAssistantMsg.includes("falar com o gerente") || 
          lastAssistantMsg.includes("consultar o gerente") ||
          (lastAssistantMsg.includes("um momento") && !lastAssistantMsg.includes("desconto"));
        
        // Count how many times a discount was actually given
        const discountMessages = allAssistantMsgs.filter((m: any) => {
          const c = m.content.toLowerCase();
          return (c.includes("consegui") || c.includes("desconto especial") || c.includes("desconto total")) && 
                 c.includes("r$") && c.includes("desconto");
        });
        const discountCount = discountMessages.length;
        
        // Check if client is asking for a specific price
        const userMsg = messageText.toLowerCase();
        const askingSpecificPrice = /(?:faz|quero|pode|fech[aeo]|consegu[ei]|por|aceito)\s*(?:por\s*)?r?\$?\s*\d+/i.test(userMsg) ||
          /^\s*\d{2,3}\s*(?:reais)?\s*$/i.test(userMsg);
        
        if (lastMentionsManager && discountCount === 0) {
          negotiationHint = `\n\nATENÇÃO URGENTE: Na sua ÚLTIMA mensagem você disse ao cliente que ia verificar com o gerente. Agora você DEVE retornar dizendo que CONSEGUIU um desconto de R$ ${descontoEtapa1.toFixed(2)} por unidade para P13/P20. Diga o preço original, o desconto e o preço final. NÃO diga que vai verificar novamente.`;
        } else if (lastMentionsManager && discountCount >= 1) {
          negotiationHint = `\n\nATENÇÃO URGENTE: Você já deu um primeiro desconto antes E na última mensagem disse que ia tentar novamente com o gerente. Agora você DEVE retornar com o desconto FINAL TOTAL de R$ ${descontoEtapa2.toFixed(2)} por unidade${precoMinimoP13 ? ` (preço final P13: R$ ${precoMinimoP13.toFixed(2)})` : ''}${precoMinimoP20 ? ` (preço final P20: R$ ${precoMinimoP20.toFixed(2)})` : ''}. Esse é o menor preço possível. NÃO diga que vai verificar novamente.`;
        } else if (discountCount === 1 && askingSpecificPrice) {
          negotiationHint = `\n\nATENÇÃO: O cliente já recebeu o primeiro desconto de R$ ${descontoEtapa1.toFixed(2)} mas está pedindo um preço ainda menor. Diga que vai verificar com o gerente se consegue chegar nesse valor. Diga APENAS que vai verificar. NÃO dê desconto nesta mensagem.`;
        } else if (discountCount >= 2) {
          negotiationHint = `\n\nATENÇÃO: Você já ofereceu o desconto máximo possível (R$ ${descontoEtapa2.toFixed(2)} por unidade). Se o cliente pedir mais desconto, diga educadamente que esse é o menor preço possível. NÃO ofereça mais desconto.`;
        }
      }
    }

    await supabase.from("ai_mensagens").insert({
      conversa_id: conversationUUID,
      role: "user",
      content: messageText,
      metadata: {
        source: "zapi-webhook",
        message_id: incomingMessageKey,
        raw_message_id: body.messageId ?? null,
        moment: body.momment ?? null,
      },
    });

    await supabase.from("ai_conversas").upsert(
      {
        id: conversationUUID,
        user_id: "00000000-0000-0000-0000-000000000000",
        titulo: `WhatsApp: ${clienteNome || senderName || normalized}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (hasRecentWhatsappOrder && !looksLikeNewOrderIntent && isPostOrderFollowUp) {
      const alreadyConfirmedReply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 30 a 60 minutos).";

      await supabase.from("ai_mensagens").insert({
        conversa_id: conversationUUID,
        role: "assistant",
        content: alreadyConfirmedReply,
        metadata: { source: "zapi-webhook", post_order_followup: true },
      });

      await sendWhatsAppMessage(ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_SECURITY_TOKEN, phone, alreadyConfirmedReply);

      return new Response(JSON.stringify({ ok: true, skipped: "post_order_followup" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const finalSystemPrompt = systemPrompt + negotiationHint;
    console.log("Negotiation hint:", negotiationHint || "none");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...history,
          { role: "user", content: messageText },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      console.error("AI error:", status);
      const fallback =
        status === 429
          ? "Desculpe, estamos com muitas mensagens no momento. Tente novamente em instantes! 😊"
          : "Desculpe, tive um problema técnico. Tente novamente ou ligue para nós! 📞";

      await sendWhatsAppMessage(ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_SECURITY_TOKEN, phone, fallback);
      return new Response(JSON.stringify({ ok: true, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    let reply = aiResult.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";

    await supabase.from("ai_mensagens").insert({
      conversa_id: conversationUUID,
      role: "assistant",
      content: reply,
    });

    // Check for confirmed order
    const orderMatch = reply.match(/\[PEDIDO_CONFIRMADO\]([\s\S]*?)\[\/PEDIDO_CONFIRMADO\]/);
    if (orderMatch) {
      const orderData = parseOrderData(orderMatch[1]);
      if (orderData) {
        // Dedup: check if an order was already created for this phone in the last 2 minutes
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: recentOrders2 } = await supabase
          .from("pedidos")
          .select("id")
          .eq("canal_venda", "whatsapp")
          .gte("created_at", twoMinAgo)
          .ilike("observacoes", `%${normalized}%`)
          .limit(1);

        if (recentOrders2 && recentOrders2.length > 0) {
          console.log("Duplicate order prevented for phone:", normalized);
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();
          reply += "\n\nSeu pedido já foi registrado anteriormente! Aguarde a entrega. 😊";
        } else {
          const isAgendado = isOffHours || orderData.agendado === "sim";

          const { data: recentAssistantMsgs } = await supabase
            .from("ai_mensagens")
            .select("content")
            .eq("conversa_id", conversationUUID)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(30);

          const fallbackDiscountPerUnit = extractLatestNegotiatedDiscountPerUnit([
            reply,
            ...((recentAssistantMsgs || []).map((m: any) => m.content)),
          ]);

          await createOrder(
            supabase,
            orderData,
            clienteId,
            clienteNome,
            senderName,
            normalized,
            resolvedUnidadeId,
            isAgendado,
            fallbackDiscountPerUnit
          );
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();

          const descontoInformado = parseFloat(String(orderData.desconto ?? "").replace(",", ".")) || 0;
          const desconto = descontoInformado > 0
            ? descontoInformado
            : (fallbackDiscountPerUnit > 0 ? fallbackDiscountPerUnit * (parseInt(orderData.quantidade) || 1) : 0);
          const descontoMsg = desconto > 0 ? ` (com desconto de R$ ${desconto.toFixed(2)})` : "";

          if (isAgendado) {
            reply += `\n\n📋 Pedido agendado com sucesso${descontoMsg}! Será entregue assim que abrirmos. Fique tranquilo!`;
          } else {
            reply += `\n\n✅ Pedido registrado com sucesso${descontoMsg}! Você receberá atualizações sobre a entrega.`;
          }
        }
      }
    }

    // Only register CallerID popup when an order is actually confirmed
    if (orderMatch) {
      await supabase.from("chamadas_recebidas").insert({
        telefone: phone,
        cliente_id: clienteId,
        cliente_nome: clienteNome || senderName,
        tipo: "whatsapp",
        status: "recebida",
        unidade_id: resolvedUnidadeId,
      });
    }

    await sendWhatsAppMessage(ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_SECURITY_TOKEN, phone, reply);

    // Auto follow-up: if Bia said she'll check with the manager, automatically send deterministic discount after delay
    const replyLower = reply.toLowerCase();
    const mentionedManager =
      replyLower.includes("verificar com o gerente") ||
      replyLower.includes("falar com o gerente") ||
      replyLower.includes("consultar o gerente") ||
      (replyLower.includes("um momento") && !replyLower.includes("desconto"));
    const alreadyHasDiscount = replyLower.includes("desconto") && replyLower.includes("r$");

    if (mentionedManager && !alreadyHasDiscount && descontoEtapa1 > 0) {
      console.log("Auto follow-up: Bia mentioned manager, scheduling discount response in 5s");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Race condition guard: check if a newer user message arrived while we waited
      const { data: newerMsgs } = await supabase
        .from("ai_mensagens")
        .select("id")
        .eq("conversa_id", conversationUUID)
        .eq("role", "user")
        .gt("created_at", new Date(Date.now() - 4000).toISOString())
        .limit(1);

      if (newerMsgs && newerMsgs.length > 0) {
        console.log("Auto follow-up cancelled: newer user message detected (handled by its own webhook)");
      } else {
        const formatBRL = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

        // Extra idempotency for delayed follow-up
        const { data: existingFollowUp } = await supabase
          .from("ai_mensagens")
          .select("id")
          .eq("conversa_id", conversationUUID)
          .eq("role", "assistant")
          .contains("metadata", { auto_followup_for: incomingMessageKey })
          .limit(1);

        if (existingFollowUp && existingFollowUp.length > 0) {
          console.log("Auto follow-up skipped: already sent for", incomingMessageKey);
          return new Response(JSON.stringify({ ok: true, skipped: "duplicate_followup" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Re-read history to get accurate discount count
        const { data: freshHistory } = await supabase
          .from("ai_mensagens")
          .select("role, content")
          .eq("conversa_id", conversationUUID)
          .eq("role", "assistant")
          .order("created_at", { ascending: true });

        const freshAssistant = freshHistory || [];
        const discountGivenCount = freshAssistant.filter((m: any) => {
          const c = m.content.toLowerCase();
          return (c.includes("consegui") || c.includes("desconto especial") || c.includes("desconto total")) && 
                 c.includes("r$") && c.includes("desconto");
        }).length;

        const p13 = produtos?.find((p: any) => /p\s*13|13\s*kg|glp\s*13/i.test((p.nome || "").toLowerCase()));
        const p20 = produtos?.find((p: any) => /p\s*20|20\s*kg/i.test((p.nome || "").toLowerCase()));
        const p13Base = p13 ? Number(p13.preco) : null;
        const p20Base = p20 ? Number(p20.preco) : null;

        let followUpReply = "";

        if (discountGivenCount >= 1) {
          // Stage 3: final floor
          const p13Final = precoMinimoP13 ?? (p13Base !== null ? Math.max(0, p13Base - descontoEtapa2) : null);
          const p20Final = precoMinimoP20 ?? (p20Base !== null ? Math.max(0, p20Base - descontoEtapa2) : null);

          const lines: string[] = [
            "Consegui falar com o gerente novamente ✅",
            `Fechamos no valor mínimo: desconto total de ${formatBRL(descontoEtapa2)} por unidade.`,
          ];
          if (p13Base !== null && p13Final !== null) {
            lines.push(`• P13: de ${formatBRL(p13Base)} por ${formatBRL(p13Final)}.`);
          }
          if (p20Base !== null && p20Final !== null) {
            lines.push(`• P20: de ${formatBRL(p20Base)} por ${formatBRL(p20Final)}.`);
          }
          lines.push("Esse é o menor preço que consigo hoje. Posso confirmar seu pedido?");
          followUpReply = lines.join("\n");
        } else {
          // Stage 2: first discount
          const p13Step2 = p13Base !== null ? Math.max(0, p13Base - descontoEtapa1) : null;
          const p20Step2 = p20Base !== null ? Math.max(0, p20Base - descontoEtapa1) : null;

          const lines: string[] = [
            "Consegui um desconto com o gerente ✅",
            `Desconto especial de ${formatBRL(descontoEtapa1)} por unidade.`,
          ];
          if (p13Base !== null && p13Step2 !== null) {
            lines.push(`• P13: de ${formatBRL(p13Base)} por ${formatBRL(p13Step2)}.`);
          }
          if (p20Base !== null && p20Step2 !== null) {
            lines.push(`• P20: de ${formatBRL(p20Base)} por ${formatBRL(p20Step2)}.`);
          }
          lines.push("Se quiser, eu já confirmo seu pedido agora.");
          followUpReply = lines.join("\n");
        }

        await supabase.from("ai_mensagens").insert({
          conversa_id: conversationUUID,
          role: "assistant",
          content: followUpReply,
          metadata: {
            source: "zapi-webhook",
            auto_followup_for: incomingMessageKey,
          },
        });

        await sendWhatsAppMessage(ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_SECURITY_TOKEN, phone, followUpReply);
        console.log("Auto follow-up sent, discount count was:", discountGivenCount);
      }
    }

    return new Response(JSON.stringify({ ok: true, reply: reply.substring(0, 100) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Z-API webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsAppMessage(instanceId: string, token: string, securityToken: string | null, phone: string, message: string) {
  try {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (securityToken) {
      headers["Client-Token"] = securityToken;
    }
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone, message }),
    });
    if (!resp.ok) {
      console.error("Z-API send error:", resp.status, await resp.text());
    }
  } catch (e) {
    console.error("Failed to send WhatsApp message:", e);
  }
}

function parseOrderData(raw: string): Record<string, string> | null {
  const lines = raw.trim().split("\n");
  const data: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length) {
      data[key.trim().toLowerCase()] = valueParts.join(":").trim();
    }
  }
  return data.produto && data.quantidade ? data : null;
}

function extractLatestNegotiatedDiscountPerUnit(messages: string[]): number {
  for (const raw of messages) {
    const content = (raw || "").toLowerCase();

    const totalMatch = content.match(/desconto\s+(?:total\s+de|especial\s+de|de)\s*r\$\s*([\d.,]+)/i);
    if (totalMatch?.[1]) {
      const value = parseFloat(totalMatch[1].replace(".", "").replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return 0;
}

async function createOrder(
  supabase: any,
  orderData: Record<string, string>,
  clienteId: string | null,
  clienteNome: string | null,
  senderName: string,
  phone: string,
  unidadeId: string | null,
  isAgendado: boolean = false,
  fallbackDiscountPerUnit: number = 0
) {
  try {
    let produto: any = null;

    const { data: produtos } = await supabase
      .from("produtos")
      .select("id, nome, preco")
      .eq("ativo", true)
      .ilike("nome", `%${orderData.produto}%`)
      .limit(1);

    produto = produtos?.[0];

    if (!produto) {
      const keyMatch = orderData.produto.match(/(P\s*13|P\s*20|P\s*45|20\s*L|13|20|45)/i);
      if (keyMatch) {
        const num = keyMatch[1].replace(/\D/g, "");
        const { data: fallback } = await supabase
          .from("produtos")
          .select("id, nome, preco")
          .eq("ativo", true)
          .or(`nome.ilike.%P${num}%,nome.ilike.%${num}kg%,nome.ilike.%${num}L%`)
          .limit(1);
        produto = fallback?.[0];
      }
    }

    if (!produto) {
      console.error("Product not found:", orderData.produto);
      return;
    }

    const quantidade = parseInt(orderData.quantidade) || 1;
    const descontoInformado = parseFloat(String(orderData.desconto ?? "").replace(",", ".")) || 0;
    const descontoCalculado = descontoInformado > 0
      ? descontoInformado
      : (fallbackDiscountPerUnit > 0 ? fallbackDiscountPerUnit * quantidade : 0);
    const valorTotal = Math.max(0, (produto.preco * quantidade) - descontoCalculado);

    const paymentMap: Record<string, string> = {
      dinheiro: "dinheiro",
      pix: "pix",
      "cartão": "cartao",
      cartao: "cartao",
      "crédito": "cartao",
      credito: "cartao",
      "débito": "cartao",
      debito: "cartao",
    };

    const formaPagamento = paymentMap[orderData.pagamento?.toLowerCase()] || "dinheiro";

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: clienteId,
        valor_total: valorTotal,
        forma_pagamento: formaPagamento,
        status: isAgendado ? "agendado" : "pendente",
        canal_venda: "whatsapp",
        endereco_entrega: orderData.endereco || "",
        observacoes: `Pedido via WhatsApp${isAgendado ? ' (AGENDADO)' : ''} - ${orderData.nome || clienteNome || senderName} (${phone})${descontoCalculado > 0 ? ` | Desconto: R$${descontoCalculado.toFixed(2)}` : ''}`,
        unidade_id: unidadeId,
      })
      .select()
      .single();

    if (error) {
      console.error("Order insert error:", error);
      return;
    }

    const { error: itemError } = await supabase.from("pedido_itens").insert({
      pedido_id: pedido.id,
      produto_id: produto.id,
      quantidade,
      preco_unitario: produto.preco,
    });

    if (itemError) {
      console.error("Order item insert error:", itemError);
    }

    console.log("Order created:", pedido.id, "unidade:", unidadeId, "produto:", produto.nome);
  } catch (e) {
    console.error("Create order error:", e);
  }
}

async function generateUUIDFromString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  const hex = Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
