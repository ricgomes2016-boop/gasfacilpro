// bia-core.ts — Lógica compartilhada da BIA (WhatsApp assistant)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========== TYPES ==========
export interface BiaConfig {
  instanceId: string;
  token: string;
  securityToken?: string | null;
  unidadeId: string | null;
  descontoEtapa1: number;
  descontoEtapa2: number;
  precoMinimoP13: number | null;
  precoMinimoP20: number | null;
  provedor: "zapi" | "uazapi";
}

export interface ClienteInfo {
  id: string | null;
  nome: string | null;
  endereco: string | null;
}

// ========== SUPABASE ==========
export function createSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ========== RESOLVE CONFIG ==========
export async function resolveConfig(
  supabase: any,
  provedor: "zapi" | "uazapi",
  queryUnidadeId: string | null,
  payloadInstanceId: string | null
): Promise<BiaConfig | null> {
  const strategies = [];

  if (queryUnidadeId) {
    strategies.push(
      supabase.from("integracoes_whatsapp").select("*")
        .eq("unidade_id", queryUnidadeId).eq("provedor", provedor).eq("ativo", true).maybeSingle()
    );
  }
  if (payloadInstanceId) {
    strategies.push(
      supabase.from("integracoes_whatsapp").select("*")
        .eq("instance_id", payloadInstanceId).eq("ativo", true).maybeSingle()
    );
  }
  strategies.push(
    supabase.from("integracoes_whatsapp").select("*")
      .eq("provedor", provedor).eq("ativo", true).limit(2)
  );

  for (const strategy of strategies) {
    const { data } = await strategy;
    const config = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    if (config?.instance_id && config?.token) {
      return {
        instanceId: config.instance_id,
        token: config.token,
        securityToken: config.security_token || null,
        unidadeId: config.unidade_id,
        descontoEtapa1: config.desconto_etapa1 ?? 5,
        descontoEtapa2: config.desconto_etapa2 ?? 10,
        precoMinimoP13: config.preco_minimo_p13 ?? null,
        precoMinimoP20: config.preco_minimo_p20 ?? null,
        provedor,
      };
    }
  }
  return null;
}

// ========== BUSINESS HOURS ==========
export async function checkBusinessHours(supabase: any, unidadeId: string | null) {
  if (!unidadeId) return { isOffHours: false, horarioInfo: "" };

  const { data: u } = await supabase.from("unidades")
    .select("horario_abertura, horario_fechamento").eq("id", unidadeId).maybeSingle();

  if (!u?.horario_abertura || !u?.horario_fechamento) return { isOffHours: false, horarioInfo: "" };

  const now = new Date();
  const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
  const cur = `${String(brt.getHours()).padStart(2, "0")}:${String(brt.getMinutes()).padStart(2, "0")}`;

  return {
    isOffHours: cur < u.horario_abertura || cur >= u.horario_fechamento,
    horarioInfo: `das ${u.horario_abertura} às ${u.horario_fechamento}`,
  };
}

// ========== NORMALIZE PHONE ==========
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-11);
}

// ========== FIND CLIENT ==========
export async function findCliente(supabase: any, phone: string): Promise<ClienteInfo> {
  const normalized = normalizePhone(phone);
  const patterns = [normalized, normalized.slice(-10)];

  const { data } = await supabase.from("clientes")
    .select("id, nome, telefone, endereco, bairro, numero")
    .or(patterns.map(p => `telefone.ilike.%${p}%`).join(","))
    .limit(1);

  if (data?.[0]) {
    return {
      id: data[0].id,
      nome: data[0].nome,
      endereco: [data[0].endereco, data[0].numero, data[0].bairro].filter(Boolean).join(", "),
    };
  }
  return { id: null, nome: null, endereco: null };
}

// ========== RECENT ORDERS ==========
export async function getRecentOrders(supabase: any, clienteId: string | null) {
  if (!clienteId) return "";

  const { data } = await supabase.from("pedidos")
    .select("id, valor_total, status, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false }).limit(3);

  if (!data?.length) return "";
  return data.map((p: any) => `- Pedido ${p.id.slice(0, 8)}: R$${p.valor_total} (${p.status})`).join("\n");
}

// ========== GET ORDER STATUS (NEW) ==========
export async function getOrderStatus(supabase: any, clienteId: string | null, phone: string) {
  if (!clienteId) return null;

  const { data } = await supabase.from("pedidos")
    .select("id, valor_total, status, created_at, endereco_entrega, entregadores:entregador_id(nome)")
    .eq("cliente_id", clienteId)
    .in("status", ["pendente", "em_preparo", "saiu_entrega", "agendado"])
    .order("created_at", { ascending: false }).limit(1);

  if (!data?.[0]) return null;

  const p = data[0];
  const statusMap: Record<string, string> = {
    pendente: "recebido e aguardando preparo",
    em_preparo: "sendo preparado",
    saiu_entrega: `a caminho${p.entregadores?.nome ? ` com ${p.entregadores.nome}` : ""}`,
    agendado: "agendado para entrega",
  };

  return {
    id: p.id.slice(0, 8),
    status: statusMap[p.status] || p.status,
    valor: p.valor_total,
  };
}

// ========== PRODUCTS ==========
export async function getProducts(supabase: any, unidadeId: string | null) {
  let q = supabase.from("produtos").select("nome, preco, estoque")
    .eq("ativo", true).gt("estoque", 0).order("nome").limit(15);
  if (unidadeId) q = q.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

  const { data } = await q;
  return data
    ? data.map((p: any) => `- ${p.nome}: R$ ${Number(p.preco).toFixed(2)}`).join("\n")
    : "Produtos indisponíveis no momento.";
}

// ========== BUILD SYSTEM PROMPT (IMPROVED) ==========
export function buildSystemPrompt(
  productList: string,
  cliente: ClienteInfo,
  recentOrders: string,
  normalized: string,
  config: BiaConfig,
  isOffHours: boolean,
  horarioInfo: string,
  orderStatus: any | null,
  negotiationHint: string
): string {
  return `Você é a Bia, atendente real da empresa pelo WhatsApp. Você é uma pessoa, NÃO um robô.
NUNCA diga que é IA, bot ou assistente virtual. Você é a Bia, atendente.

ESTILO (OBRIGATÓRIO):
- Mensagens CURTAS: máximo 2-3 linhas. Nada de textão.
- Tom simpático e direto. No máximo 1 emoji por mensagem.
- NUNCA pergunte sobre troco. Ignore completamente o assunto.
- NUNCA use "tanque de gás". Diga "gás", "botijão", "P13", "P20", "P45".
- NUNCA faça listas longas de produtos. Se pedir, cite os 3 principais.
- Despedida curta: "Qualquer coisa me chama! 😊"

SAUDAÇÃO:
${cliente.nome
  ? `- Cliente CADASTRADO: ${cliente.nome}. Cumprimente com o nome: "Boa noite, ${cliente.nome}! 😊" e ESPERE.`
  : "- Cliente NOVO. Cumprimente: \"Boa noite! 😊\" e ESPERE."
}
- NÃO ofereça produtos na saudação.

PRODUTOS DISPONÍVEIS:
${productList}

${cliente.nome ? `CLIENTE: ${cliente.nome}` : "CLIENTE NOVO"}
${cliente.endereco ? `ENDEREÇO: ${cliente.endereco}` : "SEM ENDEREÇO"}
${recentOrders ? `PEDIDOS RECENTES:\n${recentOrders}` : ""}

${orderStatus ? `PEDIDO ATIVO: #${orderStatus.id} — ${orderStatus.status} (R$ ${orderStatus.valor})
Se o cliente perguntar sobre status/entrega/pedido, informe o status acima.` : ""}

FLUXO DO PEDIDO (seja RÁPIDA e OBJETIVA):
${cliente.endereco
  ? `- Cliente com endereço: quando pedir produto, confirme: "Entrego na ${cliente.endereco}? Qual a forma de pagamento?"`
  : "- Cliente novo: pergunte nome e endereço. Depois, forma de pagamento."
}
- Peça SÓ o que falta. Se falta só pagamento, pergunte SÓ isso.
- Sem especificar tipo: assuma P13. Sem quantidade: assuma 1.
- Quando tiver TUDO, finalize com:
   [PEDIDO_CONFIRMADO]
   nome: Nome
   produto: Produto
   quantidade: X
   endereco: Endereço
   pagamento: forma
   telefone: ${normalized}
   [/PEDIDO_CONFIRMADO]
- Logo após o bloco, envie o RESUMO:
  "✅ Pedido confirmado!
  📦 Xun Produto — R$ XX,XX
  📍 Endereço
  💳 Forma de pagamento
  ⏱ Prazo: 30 a 60 min"

NEGOCIAÇÃO (3 ETAPAS):
- ETAPA 1: Reclama do preço → "Deixa eu ver com o gerente!"
- ETAPA 2: Desconto de R$ ${config.descontoEtapa1.toFixed(2)}/un. Mostre preço original → final.
- ETAPA 3: Desconto TOTAL R$ ${config.descontoEtapa2.toFixed(2)}/un${config.precoMinimoP13 ? ` (P13 mínimo: R$ ${config.precoMinimoP13.toFixed(2)})` : ""}${config.precoMinimoP20 ? ` (P20 mínimo: R$ ${config.precoMinimoP20.toFixed(2)})` : ""}. Esse é o mínimo.
- NUNCA dê desconto e "vou verificar" na MESMA mensagem.
- P45, Água: preço fixo, sem desconto.
- Campo "desconto" no bloco = desconto_por_unidade × quantidade.

${isOffHours ? `FORA DO HORÁRIO (${horarioInfo}):
- "Estamos fechados agora, mas posso agendar! Quer?"
- Se sim, colete dados e adicione "agendado: sim" no bloco.` : ""}

EXEMPLO COM DESCONTO:
[PEDIDO_CONFIRMADO]
nome: João
produto: Gás P13
quantidade: 1
endereco: Rua X, 123
pagamento: pix
desconto: ${config.descontoEtapa2.toFixed(2)}
telefone: ${normalized}
[/PEDIDO_CONFIRMADO]
${negotiationHint}`;
}

// ========== NEGOTIATION HINT ==========
export function buildNegotiationHint(history: any[], config: BiaConfig, messageText: string): string {
  const assistantMsgs = history.filter((m: any) => m.role === "assistant");
  if (!assistantMsgs.length) return "";

  const last = assistantMsgs[assistantMsgs.length - 1].content.toLowerCase();
  const mentionsManager = last.includes("verificar com o gerente") || last.includes("falar com o gerente") ||
    last.includes("consultar o gerente") || (last.includes("um momento") && !last.includes("desconto"));

  const discountMsgs = assistantMsgs.filter((m: any) => {
    const c = m.content.toLowerCase();
    return (c.includes("consegui") || c.includes("desconto especial") || c.includes("desconto total")) &&
      c.includes("r$") && c.includes("desconto");
  });

  const askingPrice = /(?:faz|quero|pode|fech[aeo]|consegu[ei]|por|aceito)\s*(?:por\s*)?r?\$?\s*\d+/i.test(messageText) ||
    /^\s*\d{2,3}\s*(?:reais)?\s*$/i.test(messageText);

  if (mentionsManager && discountMsgs.length === 0) {
    return `\n\nATENÇÃO: Você disse que ia ver com o gerente. RETORNE com desconto de R$ ${config.descontoEtapa1.toFixed(2)}/un. Mostre preço original e final. NÃO diga que vai verificar de novo.`;
  }
  if (mentionsManager && discountMsgs.length >= 1) {
    return `\n\nATENÇÃO: Já deu 1º desconto. RETORNE com desconto FINAL de R$ ${config.descontoEtapa2.toFixed(2)}/un${config.precoMinimoP13 ? ` (P13: R$ ${config.precoMinimoP13.toFixed(2)})` : ""}. Esse é o mínimo.`;
  }
  if (discountMsgs.length === 1 && askingPrice) {
    return `\n\nATENÇÃO: Cliente pede preço menor. Diga "vou verificar com o gerente" — SÓ isso, sem desconto.`;
  }
  if (discountMsgs.length >= 2) {
    return `\n\nATENÇÃO: Desconto máximo já foi dado. Se pedir mais, diga educadamente que esse é o menor preço.`;
  }
  return "";
}

// ========== UUID ==========
export async function generateUUIDFromString(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(hash).slice(0, 16)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ========== CONVERSATION HISTORY ==========
export async function loadHistory(supabase: any, conversationId: string) {
  const { data } = await supabase.from("ai_mensagens")
    .select("role, content, created_at").eq("conversa_id", conversationId)
    .order("created_at", { ascending: true }).limit(20);
  return data ? data.map((m: any) => ({ role: m.role, content: m.content })) : [];
}

export async function saveMessage(supabase: any, conversationId: string, role: string, content: string, metadata?: any) {
  await supabase.from("ai_mensagens").insert({ conversa_id: conversationId, role, content, metadata });
}

export async function upsertConversation(supabase: any, conversationId: string, title: string) {
  await supabase.from("ai_conversas").upsert({
    id: conversationId,
    user_id: "00000000-0000-0000-0000-000000000000",
    titulo: title,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
}

// ========== IDEMPOTENCY ==========
export async function isDuplicate(supabase: any, conversationId: string, messageKey: string): Promise<boolean> {
  const { data } = await supabase.from("ai_mensagens").select("id")
    .eq("conversa_id", conversationId).eq("role", "user")
    .contains("metadata", { message_id: messageKey }).limit(1);
  return !!(data && data.length > 0);
}

// ========== POST-ORDER FOLLOW-UP CHECK ==========
export async function isPostOrderFollowUp(supabase: any, phone: string, messageText: string): Promise<boolean> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("pedidos").select("id")
    .eq("canal_venda", "whatsapp").gte("created_at", twoHoursAgo)
    .ilike("observacoes", `%(${phone})%`).limit(1);

  if (!data?.length) return false;

  const isNewOrder = /(quero|preciso|novo pedido|pedido|gás|gas|botij|p13|p20|p45|água|agua|comprar|entrega)/i.test(messageText);
  const isFollowUp = /(obrigad|valeu|ok|não|nao|sim|certo|perfeito|show|blz|beleza)/i.test(messageText.toLowerCase());

  return !isNewOrder && isFollowUp;
}

// ========== AI CALL ==========
export async function callAI(messages: any[]): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI_ERROR_${resp.status}`);
  }

  const result = await resp.json();
  return result.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

// ========== AUDIO TRANSCRIPTION ==========
export async function downloadAudio(config: BiaConfig, mediaUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    let fetchUrl = mediaUrl;
    const headers: Record<string, string> = {};

    // Z-API media URLs need authentication
    if (config.provedor === "zapi" && !mediaUrl.startsWith("http")) {
      fetchUrl = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/download-media`;
      headers["Content-Type"] = "application/json";
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
    } else if (config.provedor === "uazapi" && !mediaUrl.startsWith("http")) {
      fetchUrl = `https://api.uazapi.com/${config.instanceId}/download-media`;
      headers["Authorization"] = `Bearer ${config.token}`;
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(fetchUrl, { headers });
    if (!resp.ok) {
      console.error("Audio download failed:", resp.status);
      return null;
    }

    const contentType = resp.headers.get("content-type") || "audio/ogg";
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Convert to base64
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { base64, mimeType: contentType.split(";")[0] };
  } catch (e) {
    console.error("Audio download error:", e);
    return null;
  }
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    // Use Gemini with inline audio data for transcription
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: audioBase64, format: mimeType.includes("ogg") ? "ogg" : "mp3" },
              },
              {
                type: "text",
                text: "Transcreva EXATAMENTE o que a pessoa disse neste áudio. Retorne APENAS a transcrição, sem nenhum comentário ou formatação extra. Se não conseguir entender, retorne 'inaudível'.",
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      console.error("Transcription API error:", resp.status);
      return null;
    }

    const result = await resp.json();
    const text = result.choices?.[0]?.message?.content?.trim();
    if (!text || text.toLowerCase() === "inaudível") return null;

    console.log("Audio transcribed:", text.substring(0, 100));
    return text;
  } catch (e) {
    console.error("Transcription error:", e);
    return null;
  }
}

// ========== PARSE ORDER ==========
export function parseOrderData(raw: string): Record<string, string> | null {
  const lines = raw.trim().split("\n");
  const data: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...parts] = line.split(":");
    if (key && parts.length) data[key.trim().toLowerCase()] = parts.join(":").trim();
  }
  return data.produto && data.quantidade ? data : null;
}

// ========== EXTRACT DISCOUNT ==========
export function extractLatestNegotiatedDiscountPerUnit(messages: string[]): number {
  for (const raw of messages) {
    const match = (raw || "").match(/desconto\s+(?:total\s+de|especial\s+de|de)\s*r\$\s*([\d.,]+)/i);
    if (match?.[1]) {
      const v = parseFloat(match[1].replace(".", "").replace(",", "."));
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return 0;
}

// ========== CREATE ORDER ==========
export async function createOrder(
  supabase: any, orderData: Record<string, string>,
  clienteId: string | null, clienteNome: string | null,
  senderName: string, phone: string, unidadeId: string | null,
  isAgendado = false, fallbackDiscountPerUnit = 0
) {
  try {
    // Auto-register client
    if (!clienteId && (orderData.nome || senderName)) {
      const nome = orderData.nome || senderName;
      const norm = phone.replace(/\D/g, "").slice(-11);
      let empresaId: string | null = null;
      if (unidadeId) {
        const { data: u } = await supabase.from("unidades").select("empresa_id").eq("id", unidadeId).maybeSingle();
        empresaId = u?.empresa_id || null;
      }
      const insert: any = { nome, telefone: norm, endereco: orderData.endereco || null };
      if (empresaId) insert.empresa_id = empresaId;
      const { data: novo, error } = await supabase.from("clientes").insert(insert).select("id").single();
      if (!error && novo) {
        clienteId = novo.id;
        if (unidadeId) await supabase.from("cliente_unidades").insert({ cliente_id: clienteId, unidade_id: unidadeId }).maybeSingle();
      }
    }

    // Update empty address
    if (clienteId && orderData.endereco) {
      const { data: ex } = await supabase.from("clientes").select("endereco").eq("id", clienteId).maybeSingle();
      if (ex && !ex.endereco) await supabase.from("clientes").update({ endereco: orderData.endereco }).eq("id", clienteId);
    }

    // Find product
    let produto: any = null;
    const { data: prods } = await supabase.from("produtos").select("id, nome, preco")
      .eq("ativo", true).ilike("nome", `%${orderData.produto}%`).limit(1);
    produto = prods?.[0];
    if (!produto) {
      const m = orderData.produto.match(/(P\s*13|P\s*20|P\s*45|20\s*L|13|20|45)/i);
      if (m) {
        const n = m[1].replace(/\D/g, "");
        const { data: fb } = await supabase.from("produtos").select("id, nome, preco")
          .eq("ativo", true).or(`nome.ilike.%P${n}%,nome.ilike.%${n}kg%,nome.ilike.%${n}L%`).limit(1);
        produto = fb?.[0];
      }
    }
    if (!produto) { console.error("Product not found:", orderData.produto); return; }

    const qty = parseInt(orderData.quantidade) || 1;
    const discInf = parseFloat(String(orderData.desconto ?? "").replace(",", ".")) || 0;
    const disc = discInf > 0 ? discInf : (fallbackDiscountPerUnit > 0 ? fallbackDiscountPerUnit * qty : 0);
    const total = Math.max(0, produto.preco * qty - disc);

    const payMap: Record<string, string> = {
      dinheiro: "dinheiro", pix: "pix", "cartão": "cartao", cartao: "cartao",
      "crédito": "cartao", credito: "cartao", "débito": "cartao", debito: "cartao",
    };

    const { data: ped, error } = await supabase.from("pedidos").insert({
      cliente_id: clienteId, valor_total: total,
      forma_pagamento: payMap[orderData.pagamento?.toLowerCase()] || "dinheiro",
      status: isAgendado ? "agendado" : "pendente", canal_venda: "whatsapp",
      endereco_entrega: orderData.endereco || "",
      observacoes: `Pedido via WhatsApp${isAgendado ? " (AGENDADO)" : ""} - ${orderData.nome || clienteNome || senderName} (${phone})${disc > 0 ? ` | Desconto: R$${disc.toFixed(2)}` : ""}`,
      unidade_id: unidadeId,
    }).select().single();

    if (error) { console.error("Order insert error:", error); return; }
    await supabase.from("pedido_itens").insert({
      pedido_id: ped.id, produto_id: produto.id, quantidade: qty, preco_unitario: produto.preco,
    });
    console.log("Order created:", ped.id);
  } catch (e) { console.error("Create order error:", e); }
}

// ========== SEND TYPING INDICATOR ==========
export async function sendTyping(config: BiaConfig, phone: string) {
  try {
    if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/typing`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone }) });
    } else {
      await fetch(`https://api.uazapi.com/${config.instanceId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
        body: JSON.stringify({ to: phone.replace(/\D/g, "") }),
      });
    }
  } catch (e) { console.error("Typing indicator error:", e); }
}

// ========== SEND MESSAGE ==========
export async function sendMessage(config: BiaConfig, phone: string, message: string) {
  try {
    if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-text`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
    } else {
      await fetch(`https://api.uazapi.com/${config.instanceId}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
        body: JSON.stringify({ to: phone.replace(/\D/g, ""), text: message }),
      });
    }
  } catch (e) { console.error("Send message error:", e); }
}

// ========== REGISTER CALL ==========
export async function registerCall(supabase: any, phone: string, clienteId: string | null, clienteNome: string | null, senderName: string, unidadeId: string | null) {
  await supabase.from("chamadas_recebidas").insert({
    telefone: phone, cliente_id: clienteId, cliente_nome: clienteNome || senderName,
    tipo: "whatsapp", status: "recebida", unidade_id: unidadeId,
  });
}
