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
    console.log("UaZapi webhook received:", JSON.stringify(body).substring(0, 500));

    // UaZapi payload format normalization
    // UaZapi sends: { cmd: "chat", from, text, id, ... }
    const isFromMe = body.fromMe === true || body.direction === "sent";
    if (isFromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMessage = body.cmd === "chat" || body.type === "chat" || body.isNewMsg === true;
    if (!isMessage) {
      return new Response(JSON.stringify({ ok: true, skipped: "not_message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = body.from || body.phone || body.sender || "";
    const messageText = body.text || body.body || body.content || "";
    const senderName = body.senderName || body.pushName || body.chatName || "";
    const isGroup = body.isGroup === true || (phone && phone.includes("@g.us"));

    if (isGroup || !phone || !messageText) {
      return new Response(JSON.stringify({ ok: true, skipped: "invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve credentials
    const url = new URL(req.url);
    const queryUnidadeId = url.searchParams.get("unidade_id");

    let resolvedUnidadeId: string | null = null;
    let instanceId: string | null = null;
    let token: string | null = null;
    let descontoEtapa1 = 5;
    let descontoEtapa2 = 10;
    let precoMinimoP13: number | null = null;
    let precoMinimoP20: number | null = null;

    // Strategy 1: by unidade_id query param
    if (queryUnidadeId) {
      const { data: config } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("unidade_id", queryUnidadeId)
        .eq("provedor", "uazapi")
        .eq("ativo", true)
        .maybeSingle();

      if (config) {
        instanceId = config.instance_id;
        token = config.token;
        resolvedUnidadeId = config.unidade_id;
        descontoEtapa1 = config.desconto_etapa1 ?? 5;
        descontoEtapa2 = config.desconto_etapa2 ?? 10;
        precoMinimoP13 = config.preco_minimo_p13 ?? null;
        precoMinimoP20 = config.preco_minimo_p20 ?? null;
      }
    }

    // Strategy 2: fallback single-config
    if (!instanceId) {
      const { data: configs } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("provedor", "uazapi")
        .eq("ativo", true)
        .limit(2);

      if (configs && configs.length === 1) {
        instanceId = configs[0].instance_id;
        token = configs[0].token;
        resolvedUnidadeId = configs[0].unidade_id;
        descontoEtapa1 = configs[0].desconto_etapa1 ?? 5;
        descontoEtapa2 = configs[0].desconto_etapa2 ?? 10;
        precoMinimoP13 = configs[0].preco_minimo_p13 ?? null;
        precoMinimoP20 = configs[0].preco_minimo_p20 ?? null;
      }
    }

    if (!instanceId || !token) {
      throw new Error("UaZapi credentials not configured");
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

    // Products
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

    // AI prompt (same as Z-API webhook)
    const systemPrompt = `Você é a Bia, atendente real da empresa pelo WhatsApp. Você é uma pessoa, NÃO um robô ou IA. NUNCA diga que é inteligência artificial, assistente virtual, bot ou qualquer coisa do tipo. Se perguntarem, diga que é a Bia, atendente da empresa.

ESTILO DE COMUNICAÇÃO (MUITO IMPORTANTE):
- Mensagens CURTAS e RÁPIDAS, como uma atendente humana digitando no celular.
- Máximo 2-3 linhas por mensagem. Nada de textão.
- Tom natural e simpático. Use "😊" ou "✅" com moderação (máximo 1 por mensagem).
- NÃO use linguagem formal demais. Seja direta e amigável.
- NÃO pergunte sobre troco. NUNCA.
- NÃO faça despedidas longas.
- NUNCA use "tanque de gás". Diga apenas "gás", "botijão" ou o nome do produto (P13, P20, P45). Somos uma revenda de gás, não de tanques.

PRODUTOS DISPONÍVEIS:
${productList}

${clienteNome ? `CLIENTE: ${clienteNome}` : "CLIENTE NOVO"}
${clienteEndereco ? `ENDEREÇO: ${clienteEndereco}` : ""}
${recentOrders ? `ÚLTIMOS PEDIDOS:\n${recentOrders}` : ""}

REGRAS:
- Se o cliente já tem cadastro com endereço, confirme rapidamente.
- Para clientes recorrentes, seja ainda mais direta.

FLUXO DO PEDIDO:
1. Precisa de: produto, quantidade, endereço e pagamento.
2. Cliente novo: pedir nome também.
3. Peça SÓ o que falta.
4. Quando tiver tudo, finalize com:
   [PEDIDO_CONFIRMADO]
   nome: Nome
   produto: Produto
   quantidade: X
   endereco: Endereço
   pagamento: forma
   [/PEDIDO_CONFIRMADO]
5. Prazo: 30 a 60 minutos.
6. NÃO invente preços.

NEGOCIAÇÃO DE PREÇO (TRÊS ETAPAS):
- ETAPA 1: Cliente reclama do preço → "Deixa eu ver com o gerente, um momento!"
- ETAPA 2: Retorne com desconto de R$ ${descontoEtapa1.toFixed(2)}/un.
- ETAPA 3: Desconto TOTAL R$ ${descontoEtapa2.toFixed(2)}/un${precoMinimoP13 ? ` (P13 mínimo: R$ ${precoMinimoP13.toFixed(2)})` : ''}${precoMinimoP20 ? ` (P20 mínimo: R$ ${precoMinimoP20.toFixed(2)})` : ''}. Esse é o mínimo.
- NUNCA dê desconto e "vou verificar" na MESMA mensagem.
${isOffHours ? `
FORA DO HORÁRIO (${horarioInfo}):
- "Estamos fechados agora, mas posso agendar pra quando abrirmos! Quer?"
- Se sim, colete dados e adicione "agendado: sim" no bloco.
` : ''}`;

    const conversationUUID = await generateUUIDFromString(`whatsapp_${normalized}`);
    const incomingMessageKey = body.id || body.messageId || `${normalized}_${Date.now()}_${messageText.trim().toLowerCase().slice(0, 30)}`;

    // Idempotency
    const { data: duplicatedEvent } = await supabase
      .from("ai_mensagens")
      .select("id")
      .eq("conversa_id", conversationUUID)
      .eq("role", "user")
      .contains("metadata", { message_id: incomingMessageKey })
      .limit(1);

    if (duplicatedEvent && duplicatedEvent.length > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "duplicate_event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // History
    const { data: historyRows } = await supabase
      .from("ai_mensagens")
      .select("role, content, created_at")
      .eq("conversa_id", conversationUUID)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = historyRows
      ? historyRows.map((m: any) => ({ role: m.role, content: m.content }))
      : [];

    // Save inbound
    await supabase.from("ai_mensagens").insert({
      conversa_id: conversationUUID,
      role: "user",
      content: messageText,
      metadata: { source: "uazapi-webhook", message_id: incomingMessageKey },
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

    // Post-order follow-up check
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
    const looksLikeNewOrderIntent = /(quero|preciso|novo pedido|pedido|gás|gas|botij|p13|p20|p45|água|agua|comprar|entrega)/i.test(messageText);
    const isPostOrderFollowUp = /(obrigad|valeu|ok|não|nao|sim|certo|perfeito|show|blz|beleza)/i.test(messageText.toLowerCase());

    if (hasRecentWhatsappOrder && !looksLikeNewOrderIntent && isPostOrderFollowUp) {
      const alreadyConfirmedReply = "Perfeito! Seu pedido já está confirmado ✅\nA entrega segue em andamento (prazo de 30 a 60 minutos).";

      await supabase.from("ai_mensagens").insert({
        conversa_id: conversationUUID,
        role: "assistant",
        content: alreadyConfirmedReply,
        metadata: { source: "uazapi-webhook", post_order_followup: true },
      });

      await sendUaZapiMessage(instanceId, token, phone, alreadyConfirmedReply);

      return new Response(JSON.stringify({ ok: true, skipped: "post_order_followup" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: messageText },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const fallback = aiResponse.status === 429
        ? "Desculpe, estamos com muitas mensagens no momento. Tente novamente em instantes! 😊"
        : "Desculpe, tive um problema técnico. Tente novamente ou ligue para nós! 📞";
      await sendUaZapiMessage(instanceId, token, phone, fallback);
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
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: recentOrders2 } = await supabase
          .from("pedidos")
          .select("id")
          .eq("canal_venda", "whatsapp")
          .gte("created_at", twoMinAgo)
          .ilike("observacoes", `%${normalized}%`)
          .limit(1);

        if (recentOrders2 && recentOrders2.length > 0) {
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

          await createOrder(supabase, orderData, clienteId, clienteNome, senderName, normalized, resolvedUnidadeId, isAgendado, fallbackDiscountPerUnit);
          reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();

          const descontoInformado = parseFloat(String(orderData.desconto ?? "").replace(",", ".")) || 0;
          const desconto = descontoInformado > 0
            ? descontoInformado
            : (fallbackDiscountPerUnit > 0 ? fallbackDiscountPerUnit * (parseInt(orderData.quantidade) || 1) : 0);
          const descontoMsg = desconto > 0 ? ` (com desconto de R$ ${desconto.toFixed(2)})` : "";

          reply += isAgendado
            ? `\n\n📋 Pedido agendado com sucesso${descontoMsg}! Será entregue assim que abrirmos.`
            : `\n\n✅ Pedido registrado com sucesso${descontoMsg}! Você receberá atualizações sobre a entrega.`;
        }
      }
    }

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

    await sendUaZapiMessage(instanceId, token, phone, reply);

    return new Response(JSON.stringify({ ok: true, reply: reply.substring(0, 100) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("UaZapi webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendUaZapiMessage(instanceId: string, token: string, phone: string, message: string) {
  try {
    // UaZapi API endpoint format
    const url = `https://api.uazapi.com/${instanceId}/send-text`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ to: phone.replace(/\D/g, ""), text: message }),
    });
    if (!resp.ok) {
      console.error("UaZapi send error:", resp.status, await resp.text());
    }
  } catch (e) {
    console.error("Failed to send UaZapi message:", e);
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

    if (!produto) { console.error("Product not found:", orderData.produto); return; }

    const quantidade = parseInt(orderData.quantidade) || 1;
    const descontoInformado = parseFloat(String(orderData.desconto ?? "").replace(",", ".")) || 0;
    const descontoCalculado = descontoInformado > 0
      ? descontoInformado
      : (fallbackDiscountPerUnit > 0 ? fallbackDiscountPerUnit * quantidade : 0);
    const valorTotal = Math.max(0, (produto.preco * quantidade) - descontoCalculado);

    const paymentMap: Record<string, string> = {
      dinheiro: "dinheiro", pix: "pix", "cartão": "cartao", cartao: "cartao",
      "crédito": "cartao", credito: "cartao", "débito": "cartao", debito: "cartao",
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
        observacoes: `Pedido via WhatsApp/UaZapi${isAgendado ? ' (AGENDADO)' : ''} - ${orderData.nome || clienteNome || senderName} (${phone})${descontoCalculado > 0 ? ` | Desconto: R$${descontoCalculado.toFixed(2)}` : ''}`,
        unidade_id: unidadeId,
      })
      .select()
      .single();

    if (error) { console.error("Order insert error:", error); return; }

    await supabase.from("pedido_itens").insert({
      pedido_id: pedido.id,
      produto_id: produto.id,
      quantidade,
      preco_unitario: produto.preco,
    });

    console.log("UaZapi order created:", pedido.id, "unidade:", unidadeId);
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
