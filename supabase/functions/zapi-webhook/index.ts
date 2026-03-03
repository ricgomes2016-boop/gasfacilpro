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
    console.log("Webhook v2 - multi-unidade support");

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
    // Z-API may include instanceId in payload
    const payloadInstanceId = body.instanceId || body.instance_id || null;

    let ZAPI_INSTANCE_ID: string | null = null;
    let ZAPI_TOKEN: string | null = null;
    let ZAPI_SECURITY_TOKEN: string | null = null;
    let resolvedUnidadeId: string | null = null;
    let isCentralized = false;

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
      }
    }

    // Strategy 3: try matching any active config (single-unit setups)
    if (!ZAPI_INSTANCE_ID) {
      const { data: configs } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("ativo", true)
        .limit(1);

      if (configs && configs.length > 0) {
        ZAPI_INSTANCE_ID = configs[0].instance_id;
        ZAPI_TOKEN = configs[0].token;
        ZAPI_SECURITY_TOKEN = configs[0].security_token;
        resolvedUnidadeId = configs[0].unidade_id;

        // Centralized mode: if there are multiple active configs, try to route by customer address
        if (!queryUnidadeId) {
          isCentralized = true;
        }
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

    // Centralized routing: resolve unit by customer's bairro/address
    let availableUnits: { id: string; nome: string; bairros_atendidos: string | null }[] = [];
    if (isCentralized) {
      const { data: units } = await supabase
        .from("unidades")
        .select("id, nome, bairros_atendidos")
        .eq("ativo", true);

      availableUnits = units || [];

      // Try to auto-match by customer bairro
      if (!resolvedUnidadeId && clientes?.[0]?.bairro && availableUnits.length > 0) {
        const bairroCliente = clientes[0].bairro.toLowerCase().trim();
        for (const unit of availableUnits) {
          if (unit.bairros_atendidos) {
            const bairros = unit.bairros_atendidos.split(",").map((b: string) => b.trim().toLowerCase());
            if (bairros.some((b: string) => bairroCliente.includes(b) || b.includes(bairroCliente))) {
              resolvedUnidadeId = unit.id;
              break;
            }
          }
        }
      }
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
    const systemPrompt = `Você é a Bia, atendente da empresa pelo WhatsApp. Seja simpática e profissional, com tom amigável mas sem exageros.

ESTILO:
- Fale de forma educada e natural. Evite gírias como "blz", "tô", "vc". Use português correto e acessível.
- Use no máximo 1 emoji por mensagem, e nem sempre.
- Seja objetiva. Respostas curtas e diretas.

PRODUTOS DISPONÍVEIS:
${productList}

${clienteNome ? `CLIENTE CADASTRADO: ${clienteNome}` : "CLIENTE NÃO CADASTRADO NO SISTEMA"}
${clienteEndereco ? `ENDEREÇO NO CADASTRO: ${clienteEndereco}` : ""}
${recentOrders ? `ÚLTIMOS PEDIDOS:\n${recentOrders}` : ""}
${isCentralized && availableUnits.length > 1 && !resolvedUnidadeId ? `
ROTEAMENTO DE UNIDADE:
Temos várias filiais. Quando o cliente informar o endereço/bairro, identifique qual filial atende a região.
FILIAIS DISPONÍVEIS:
${availableUnits.map((u: any) => `- ${u.nome}${u.bairros_atendidos ? ` (bairros: ${u.bairros_atendidos})` : ''}`).join('\n')}
Se não conseguir identificar a filial pelo bairro, pergunte: "Qual região ou bairro você está?"
Inclua o campo "filial" no bloco [PEDIDO_CONFIRMADO] com o nome EXATO da filial escolhida.
` : ""}

REGRA FUNDAMENTAL - NUNCA PEÇA INFORMAÇÕES JÁ FORNECIDAS:
- Se o cliente já informou nome, endereço, produto ou pagamento NESTA CONVERSA, use essas informações. NÃO peça novamente.
- Releia TODA a conversa acima antes de responder. Se algum dado já foi mencionado, considere-o como válido.
- Se o cliente tem endereço no cadastro, use-o automaticamente. Apenas confirme: "Entrego no endereço cadastrado?"

FLUXO DO PEDIDO:
1. Para fechar um pedido, você precisa de: produto, quantidade, endereço e forma de pagamento.
2. Se o cliente NÃO é cadastrado, precisa também do nome completo.
3. Peça APENAS os dados que ainda faltam. Se o cliente já informou 3 de 4 dados, peça só o que falta.
4. Quando tiver TODOS os dados (mesmo que coletados em mensagens diferentes), finalize com:
   [PEDIDO_CONFIRMADO]
   nome: Nome Completo do Cliente
   produto: Nome do Produto
   quantidade: X
   endereco: Endereço completo
   pagamento: forma
   [/PEDIDO_CONFIRMADO]
4. Prazo de entrega: 30 a 60 minutos.
5. Se o cliente não é cadastrado E não informou endereço na conversa, peça nome e endereço.
6. NÃO invente preços. Use APENAS os produtos listados.
7. Se não entender a mensagem, peça para repetir educadamente.

NEGOCIAÇÃO DE PREÇO (DUAS ETAPAS OBRIGATÓRIAS):
- ETAPA 1: Quando o cliente reclamar do preço, pedir desconto ou dizer que está caro, responda APENAS que vai verificar com o gerente. NÃO dê o desconto ainda. NÃO continue a conversa. Encerre a mensagem após dizer que vai verificar. Exemplo: "Vou verificar com o gerente se consigo um desconto para você! Um momento."
- ETAPA 2: Na PRÓXIMA mensagem do cliente (qualquer que seja), aí sim retorne dizendo que conseguiu um desconto especial. Aplique desconto APENAS para o Gás P13. Para outros produtos, diga que infelizmente o preço já é o melhor possível.
- REGRA: NUNCA diga "vou verificar" e "consegui o desconto" na MESMA mensagem. São obrigatoriamente mensagens separadas.
- IMPORTANTE: Se houve desconto, inclua o campo "desconto" no bloco [PEDIDO_CONFIRMADO] com o valor TOTAL do desconto em reais.

FORMATO DO PEDIDO CONFIRMADO (exemplo com desconto):
[PEDIDO_CONFIRMADO]
nome: Nome do Cliente
produto: Gás P13
quantidade: 1
endereco: Rua X, 123
pagamento: pix
desconto: 5.00
[/PEDIDO_CONFIRMADO]`;

    const conversationUUID = await generateUUIDFromString(`whatsapp_${normalized}`);

    const { data: historyRows } = await supabase
      .from("ai_mensagens")
      .select("role, content, created_at")
      .eq("conversa_id", conversationUUID)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = historyRows
      ? historyRows.map((m: any) => ({ role: m.role, content: m.content }))
      : [];

    await supabase.from("ai_mensagens").insert({
      conversa_id: conversationUUID,
      role: "user",
      content: messageText,
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
        // Resolve unit from AI-selected filial name
        let orderUnidadeId = resolvedUnidadeId;
        if (isCentralized && orderData.filial && availableUnits.length > 0) {
          const matched = availableUnits.find((u: any) => 
            u.nome.toLowerCase().trim() === orderData.filial.toLowerCase().trim()
          );
          if (matched) orderUnidadeId = matched.id;
        }
        await createOrder(supabase, orderData, clienteId, clienteNome, senderName, normalized, orderUnidadeId);
        reply = reply.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/, "").trim();
        reply += "\n\n✅ Pedido registrado com sucesso! Você receberá atualizações sobre a entrega.";
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

async function createOrder(
  supabase: any,
  orderData: Record<string, string>,
  clienteId: string | null,
  clienteNome: string | null,
  senderName: string,
  phone: string,
  unidadeId: string | null
) {
  try {
    // Try flexible product search
    let produto: any = null;

    const { data: produtos } = await supabase
      .from("produtos")
      .select("id, nome, preco")
      .eq("ativo", true)
      .ilike("nome", `%${orderData.produto}%`)
      .limit(1);

    produto = produtos?.[0];

    // Fallback: extract key terms like "P13", "13kg", "P20", "20L"
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
    const desconto = parseFloat(orderData.desconto) || 0;
    const valorTotal = (produto.preco * quantidade) - desconto;

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
        status: "pendente",
        canal_venda: "whatsapp",
        endereco_entrega: orderData.endereco || "",
        observacoes: `Pedido via WhatsApp - ${orderData.nome || clienteNome || senderName} (${phone})${desconto > 0 ? ` | Desconto: R$${desconto.toFixed(2)}` : ''}`,
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
