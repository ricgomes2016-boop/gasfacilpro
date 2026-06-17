// bia-core.ts — Lógica compartilhada da BIA (WhatsApp assistant)

/**
 * Remove o bloco técnico [PEDIDO_CONFIRMADO]...[/PEDIDO_CONFIRMADO] da resposta
 * da BIA antes de enviar ao cliente / salvar / exibir no chat.
 * O bloco é apenas para uso interno (parser de pedidos).
 */
export function stripPedidoConfirmadoBlock(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
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
  provedor: "zapi" | "uazapi" | "meta" | "meta_coex" | "gateway" | "evolution";
  metaPhoneNumberId?: string | null;
  /** Evolution-specific: Base URL for API calls */
  baseUrl?: string | null;
  /** Gateway-specific: URL of the gateway edge function */
  gatewayBaseUrl?: string | null;
  /** Gateway-specific: instance name for API calls */
  gatewayInstanceName?: string | null;
  /** Evolution-specific: base URL of the Evolution API (e.g. Cloudflare Tunnel) */
  evolutionBaseUrl?: string | null;
  /** Evolution-specific: instance name for Evolution API calls */
  evolutionInstanceName?: string | null;
  /** Custom agent name for this unit (default: Bia) */
  agentName?: string | null;
  tabelaPrecos?: {
    gas_p13: { preco: number; preco_desconto: number };
    gas_p20: { preco: number; preco_desconto: number };
    gas_p45: { preco: number; preco_desconto: number };
    agua_20l: { preco: number; preco_desconto: number };
  } | null;
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
  provedor: "zapi" | "uazapi" | "meta" | "meta_coex" | "gateway" | "evolution",
  queryUnidadeId: string | null,
  payloadInstanceId: string | null
): Promise<BiaConfig | null> {
  // Gateway provider: resolve from whatsapp_gateway_instances table
  if (provedor === "gateway") {
    return resolveGatewayConfig(supabase, queryUnidadeId, payloadInstanceId);
  }

  // Evolution provider: resolve from integracoes_whatsapp where provedor='evolution'
  if (provedor === "evolution") {
    return resolveEvolutionConfig(supabase, queryUnidadeId, payloadInstanceId);
  }

  // meta_coex uses the same logic as meta — both use Graph API for messaging
  const effectiveProvedor = provedor === "meta_coex" ? "meta" : provedor;
  const metaProvedores = ["meta", "meta_coex"];

  const strategies = [];
  const provedorList = metaProvedores.includes(provedor) ? metaProvedores : [provedor];

  // Tenant isolation: when queryUnidadeId is provided, ONLY match that unidade.
  // Never fall back to a different unidade's config (cross-tenant leak).
  if (queryUnidadeId) {
    strategies.push(
      supabase.from("integracoes_whatsapp").select("*")
        .eq("unidade_id", queryUnidadeId)
        .in("provedor", provedorList)
        .eq("ativo", true).maybeSingle()
    );
  } else if (payloadInstanceId) {
    // Resolve strictly by instance/phone identifier when no unidade was given.
    if (metaProvedores.includes(provedor)) {
      strategies.push(
        supabase.from("integracoes_whatsapp").select("*")
          .eq("meta_phone_number_id", payloadInstanceId)
          .in("provedor", metaProvedores)
          .eq("ativo", true).maybeSingle()
      );
      strategies.push(
        supabase.from("integracoes_whatsapp").select("*")
          .eq("instance_id", payloadInstanceId)
          .in("provedor", metaProvedores)
          .eq("ativo", true).maybeSingle()
      );
    } else {
      strategies.push(
        supabase.from("integracoes_whatsapp").select("*")
          .eq("instance_id", payloadInstanceId)
          .in("provedor", provedorList)
          .eq("ativo", true).maybeSingle()
      );
    }
  } else {
    // No tenant hint at all → only safe if a SINGLE active config exists for this provedor.
    strategies.push(
      supabase.from("integracoes_whatsapp").select("*")
        .in("provedor", provedorList)
        .eq("ativo", true).limit(2)
    );
  }

  for (const strategy of strategies) {
    const { data } = await strategy;
    const config = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    if (config?.token && (config?.instance_id || config?.meta_phone_number_id || metaProvedores.includes(provedor))) {
      return {
        instanceId: config.instance_id || config.meta_phone_number_id || "",
        token: config.token,
        securityToken: config.security_token || null,
        unidadeId: config.unidade_id,
        descontoEtapa1: config.desconto_etapa1 ?? 5,
        descontoEtapa2: config.desconto_etapa2 ?? 10,
        precoMinimoP13: config.preco_minimo_p13 ?? null,
        precoMinimoP20: config.preco_minimo_p20 ?? null,
        provedor: effectiveProvedor as BiaConfig["provedor"],
        baseUrl: config.base_url || null,
        metaPhoneNumberId: config.meta_phone_number_id || config.instance_id || null,
        agentName: config.nome_bot || "Bia",
        tabelaPrecos: config.regras_bia?.tabela_precos || null,
      };
    }
  }
  return null;
}

// ========== RESOLVE EVOLUTION CONFIG ==========
async function resolveEvolutionConfig(
  supabase: any,
  queryUnidadeId: string | null,
  instanceNameOrId: string | null
): Promise<BiaConfig | null> {
  let config: any = null;

  // Tenant isolation: if unidade explicit, ONLY match that unidade.
  if (queryUnidadeId) {
    const { data } = await supabase.from("integracoes_whatsapp").select("*")
      .eq("unidade_id", queryUnidadeId).eq("provedor", "evolution").eq("ativo", true).maybeSingle();
    config = data;
  } else if (instanceNameOrId) {
    const { data: byInstance } = await supabase.from("integracoes_whatsapp").select("*")
      .eq("instance_id", instanceNameOrId).eq("provedor", "evolution").eq("ativo", true).maybeSingle();
    config = byInstance;
  } else {
    // No tenant hint → only safe if a single active evolution config exists
    const { data } = await supabase.from("integracoes_whatsapp").select("*")
      .eq("provedor", "evolution").eq("ativo", true).limit(2);
    if (data?.length === 1) config = data[0];
  }

  if (!config?.token || !config?.base_url) return null;

  const baseUrl = (config.base_url || "").replace(/\/$/, "");

  return {
    instanceId: config.instance_id || "",
    token: config.token,
    securityToken: config.security_token || null,
    unidadeId: config.unidade_id,
    descontoEtapa1: config.desconto_etapa1 ?? 5,
    descontoEtapa2: config.desconto_etapa2 ?? 10,
    precoMinimoP13: config.preco_minimo_p13 ?? null,
    precoMinimoP20: config.preco_minimo_p20 ?? null,
    provedor: "evolution",
    metaPhoneNumberId: null,
    evolutionBaseUrl: baseUrl,
    evolutionInstanceName: config.instance_id || "",
  };
}

// ========== RESOLVE GATEWAY CONFIG ==========
async function resolveGatewayConfig(
  supabase: any,
  queryUnidadeId: string | null,
  instanceNameOrId: string | null
): Promise<BiaConfig | null> {
  let instance: any = null;

  if (instanceNameOrId) {
    // Try by instance_name first, then by id
    const { data: byName } = await supabase.from("whatsapp_gateway_instances").select("*")
      .eq("instance_name", instanceNameOrId).maybeSingle();
    instance = byName;
    if (!instance) {
      const { data: byId } = await supabase.from("whatsapp_gateway_instances").select("*")
        .eq("id", instanceNameOrId).maybeSingle();
      instance = byId;
    }
  }
  if (!instance && queryUnidadeId) {
    const { data } = await supabase.from("whatsapp_gateway_instances").select("*")
      .eq("unidade_id", queryUnidadeId).eq("status", "connected").limit(1);
    instance = data?.[0];
  }

  if (!instance) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const gatewayBaseUrl = `${supabaseUrl}/functions/v1/whatsapp-gateway-api`;

  // For gateway, we use the integracoes_whatsapp config for Bia negotiation params
  // Try to find matching config for negotiation parameters
  let descontoEtapa1 = 5, descontoEtapa2 = 10;
  let precoMinimoP13: number | null = null, precoMinimoP20: number | null = null;

  if (instance.unidade_id) {
    const { data: wpConfig } = await supabase.from("integracoes_whatsapp").select("*")
      .eq("unidade_id", instance.unidade_id).eq("ativo", true).limit(1);
    if (wpConfig?.[0]) {
      descontoEtapa1 = wpConfig[0].desconto_etapa1 ?? 5;
      descontoEtapa2 = wpConfig[0].desconto_etapa2 ?? 10;
      precoMinimoP13 = wpConfig[0].preco_minimo_p13 ?? null;
      precoMinimoP20 = wpConfig[0].preco_minimo_p20 ?? null;
    }
  }

  return {
    instanceId: instance.id,
    token: instance.api_key || "",
    securityToken: null,
    unidadeId: instance.unidade_id,
    descontoEtapa1,
    descontoEtapa2,
    precoMinimoP13,
    precoMinimoP20,
    provedor: "gateway",
    metaPhoneNumberId: null,
    gatewayBaseUrl,
    gatewayInstanceName: instance.instance_name,
    agentName: instance.agent_name || "Bia",
  };
}


export async function checkBusinessHours(supabase: any, unidadeId: string | null) {
  if (!unidadeId) return { isOffHours: false, horarioInfo: "", isSunday: false, waterDeliveryAllowed: true, empresaId: null };

  const { data: u } = await supabase.from("unidades")
    .select("horario_abertura, horario_fechamento, empresa_id, cidade, estado, bairros_atendidos, endereco, bairro, cep")
    .eq("id", unidadeId).maybeSingle();

  let empresaNome: string | null = null;
  if (u?.empresa_id) {
    const { data: emp } = await supabase.from("empresas").select("nome").eq("id", u.empresa_id).maybeSingle();
    empresaNome = emp?.nome || null;
  }

  const unidadeLocation = {
    cidade: u?.cidade || null,
    estado: u?.estado || null,
    bairros: Array.isArray(u?.bairros_atendidos) ? u.bairros_atendidos : [],
    empresaNome,
    endereco: u?.endereco || null,
    bairro: u?.bairro || null,
    cep: u?.cep || null,
  };

  if (!u?.empresa_id) return { isOffHours: false, horarioInfo: "", isSunday: false, waterDeliveryAllowed: true, empresaId: u?.empresa_id || null, unidadeLocation };

  // Fetch regras_bia from configuracoes_empresa
  const { data: configEmpresa } = await supabase.from("configuracoes_empresa")
    .select("regras_bia").eq("empresa_id", u.empresa_id).maybeSingle();

  const regras = configEmpresa?.regras_bia || {};
  const abertura = regras.horario_abertura || u?.horario_abertura || "08:00";
  const fechamento = regras.horario_fechamento || u?.horario_fechamento || "18:00";
  const domingoAtivo = regras.domingo_ativo ?? true;
  const fechamentoDomingo = regras.horario_domingo_fechamento || "18:00";
  const aguaEntregaDomingo = regras.agua_entrega_domingo ?? true;

  const now = new Date();
  const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
  const day = brt.getDay(); // 0 = Domingo
  const cur = `${String(brt.getHours()).padStart(2, "0")}:${String(brt.getMinutes()).padStart(2, "0")}`;
  const isSunday = brt.getDay() === 0;

  let effectiveClosing = fechamento;
  if (isSunday) {
    if (!domingoAtivo) {
      return { isOffHours: true, horarioInfo: "Não abrimos aos domingos", isSunday: true, waterDeliveryAllowed: false, empresaId: u.empresa_id, unidadeLocation };
    }
    // Respect dynamic Sunday closing time from regras_bia
    effectiveClosing = fechamentoDomingo;
  }

  const gasDoPovoEntrega = regras.gas_do_povo_entrega ?? false;
  const gasDoPovoTaxa = regras.gas_do_povo_taxa ?? 15;

  const autoFollowupAtivo = regras.auto_followup_ativo ?? false;

  return {
    isOffHours: cur < abertura || cur >= effectiveClosing,
    horarioInfo: `das ${abertura} às ${effectiveClosing}${isSunday ? " (horário especial de domingo)" : ""}`,
    isSunday,
    waterDeliveryAllowed: !(isSunday && !aguaEntregaDomingo),
    empresaId: u.empresa_id || null,
    gasDoPovoEntrega,
    gasDoPovoTaxa,
    autoFollowupAtivo,
    unidadeLocation,
  };
}

// ========== OFF-HOURS MESSAGE ==========
export function getOffHoursMessage(clienteNome: string | null, horarioInfo: string): string {
  const nome = clienteNome ? clienteNome.split(" ")[0] : "";
  const saudacao = nome ? `Oi ${nome}!` : "Olá!";
  return `${saudacao} 😊\nNo momento estamos *fechados*.\nNosso horário de funcionamento é *${horarioInfo}*.\n\nSe quiser, posso *agendar seu pedido* para quando abrirmos! Basta me dizer o que precisa. 📋`;
}

// ========== LOCAL FALLBACK REPLY ==========
export function buildLocalSalesFallbackReply(
  messageText: string,
  history: any[],
  cliente: ClienteInfo,
  productList: string,
): string {
  const text = messageText || "";
  const lower = text.toLowerCase();
  const nome = cliente.nome ? cliente.nome.split(" ")[0] : "";
  const prefix = nome ? `${nome}, ` : "";

  const hasProductIntent = /\b(g[aá]s|gas|botij|p\s*13|p13|p\s*20|p20|p\s*45|p45|[aá]gua|agua|gal[aã]o)\b/i.test(text);
  const asksPrice = /\b(valor|pre[cç]o|quanto|custa|sai|fica)\b/i.test(text);
  const hasGreetingOnly = /^(oi|ol[aá]|bom dia|boa tarde|boa noite|tudo bem|td bem)[\s!.?]*$/i.test(text.trim());
  const hasAddressHint = /\b(rua|avenida|av\.?|travessa|alameda|rodovia|estrada|numero|n[úu]mero|bairro|casa|apto|apartamento|\d{1,5})\b/i.test(text);
  const hasPaymentHint = /\b(pix|dinheiro|cart[aã]o|cartao|d[eé]bito|credito|cr[eé]dito|fiado|vale)\b/i.test(text);

  const p13Match = productList.match(/P13[^\d]*R\$\s*([\d.,]+)/i);
  const p20Match = productList.match(/P20[^\d]*R\$\s*([\d.,]+)/i);
  const p45Match = productList.match(/P45[^\d]*R\$\s*([\d.,]+)/i);
  const aguaMatch = productList.match(/(?:agua|gal[aã]o)[^\d]*R\$\s*([\d.,]+)/i);

  const priceForText = () => {
    if (/\bp\s*20|p20\b/i.test(lower) && p20Match) return `O P20 esta R$ ${p20Match[1]}.`;
    if (/\bp\s*45|p45\b/i.test(lower) && p45Match) return `O P45 esta R$ ${p45Match[1]}.`;
    if (/\b[aá]gua|agua|gal[aã]o\b/i.test(lower) && aguaMatch) return `A agua 20L esta R$ ${aguaMatch[1]}.`;
    if (p13Match) return `O P13 esta R$ ${p13Match[1]}.`;
    return "Consigo verificar o valor certinho para voce.";
  };

  const recentUserText = history
    .filter((m: any) => m.role === "user")
    .map((m: any) => m.content || "")
    .join("\n");
  const combined = `${recentUserText}\n${text}`;
  const alreadyHasProduct = /\b(g[aá]s|gas|botij|p\s*13|p13|p\s*20|p20|p\s*45|p45|[aá]gua|agua|gal[aã]o)\b/i.test(combined);
  const alreadyHasAddress = /\b(rua|avenida|av\.?|travessa|alameda|rodovia|estrada|numero|n[úu]mero|bairro|casa|apto|apartamento|\d{1,5})\b/i.test(combined);
  const alreadyHasPayment = /\b(pix|dinheiro|cart[aã]o|cartao|d[eé]bito|credito|cr[eé]dito|fiado|vale)\b/i.test(combined);

  if (asksPrice) {
    return `${prefix}${priceForText()} Para entrega, me envie o endereco, por favor.`;
  }
  if (hasGreetingOnly) {
    return nome ? `Oi ${nome}! Tudo bem?` : "Ola! Tudo bem?";
  }
  if (hasProductIntent && !alreadyHasAddress) {
    return `${prefix}claro! Qual o endereco para entrega?`;
  }
  if ((hasAddressHint || alreadyHasAddress) && alreadyHasProduct && !alreadyHasPayment) {
    return "Perfeito. Qual sera a forma de pagamento: pix, dinheiro ou cartao?";
  }
  if (hasPaymentHint && alreadyHasProduct && alreadyHasAddress) {
    return "Combinado! Vou encaminhar seu pedido para a equipe confirmar e sair para entrega.";
  }
  if (hasProductIntent) {
    return `${prefix}certo! Me envie o endereco para entrega, por favor.`;
  }
  return nome
    ? `Oi ${nome}! Posso ajudar com seu pedido de gas ou agua.`
    : "Ola! Posso ajudar com seu pedido de gas ou agua.";
}

// ========== IDENTIFY CONTACT ==========
export interface ContactIdentity {
  tipo: "cliente" | "entregador" | "parceiro";
  id?: string;
  nome?: string;
}

export async function identifyContact(supabase: any, phone: string): Promise<ContactIdentity> {
  const normalized = normalizePhone(phone);
  const patterns = [normalized, normalized.slice(-10)];

  // Check entregadores
  const { data: entregador } = await supabase.from("entregadores")
    .select("id, nome")
    .eq("ativo", true)
    .or(patterns.map((p: string) => `telefone.ilike.%${p}%`).join(","))
    .limit(1);

  if (entregador?.[0]) {
    console.log("Contact identified as ENTREGADOR:", entregador[0].nome);
    return { tipo: "entregador", id: entregador[0].id, nome: entregador[0].nome };
  }

  // Check vale_gas_parceiros
  const { data: parceiro } = await supabase.from("vale_gas_parceiros")
    .select("id, nome")
    .eq("ativo", true)
    .or(patterns.map((p: string) => `telefone.ilike.%${p}%`).join(","))
    .limit(1);

  if (parceiro?.[0]) {
    console.log("Contact identified as PARCEIRO:", parceiro[0].nome);
    return { tipo: "parceiro", id: parceiro[0].id, nome: parceiro[0].nome };
  }

  return { tipo: "cliente" };
}

// ========== NORMALIZE PHONE ==========
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  // Remove DDI 55 do Brasil quando presente (12 ou 13 dígitos)
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(-11);
}

// ========== FIND CLIENT ==========
export async function findCliente(supabase: any, phone: string, senderName?: string): Promise<ClienteInfo> {
  const normalized = normalizePhone(phone);
  const patterns = [normalized, normalized.slice(-10)];

  const { data } = await supabase.from("clientes")
    .select("id, nome, telefone, endereco, bairro, numero")
    .or(patterns.map(p => `telefone.ilike.%${p}%`).join(","))
    .limit(1);

  if (data?.[0]) {
    // Update generic/empty name with WhatsApp pushName
    if (senderName && senderName.trim().length >= 2) {
      const currentName = (data[0].nome || "").trim();
      const isGeneric = !currentName || /^(cliente\s*(whatsapp|vapi|novo)?|unknown|\d+)$/i.test(currentName);
      if (isGeneric) {
        await supabase.from("clientes").update({ nome: senderName.trim() }).eq("id", data[0].id);
        data[0].nome = senderName.trim();
        console.log("Updated client name:", data[0].id, "→", senderName.trim());
      }
    }
    return {
      id: data[0].id,
      nome: data[0].nome,
      endereco: [data[0].endereco, data[0].numero, data[0].bairro].filter(Boolean).join(", "),
    };
  }
  // Cliente não cadastrado: devolve o pushName do WhatsApp para uso no título/saudação
  const fallbackName = (senderName && senderName.trim().length >= 2) ? senderName.trim() : null;
  return { id: null, nome: fallbackName, endereco: null };
}

// ========== MESSAGE DEBOUNCE ==========
export async function collectBufferedMessages(supabase: any, conversationId: string, currentText: string, currentMessageId: string, delayMs = 3000): Promise<{ text: string; isLatest: boolean }> {
  // Wait for more messages to arrive
  await new Promise(resolve => setTimeout(resolve, delayMs));

  // Fetch all user messages from the last 5 seconds
  const fiveSecsAgo = new Date(Date.now() - 6000).toISOString();
  const { data: recentMsgs, error } = await supabase.from("ai_mensagens")
    .select("content, created_at, metadata")
    .eq("conversa_id", conversationId)
    .eq("role", "user")
    .gte("created_at", fiveSecsAgo)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Debounce: failed to load recent messages; replying with current text.", {
      conversationId,
      currentMessageId,
      code: error.code,
      message: error.message,
    });
    return { text: currentText, isLatest: true };
  }

  if (recentMsgs && recentMsgs.length > 0) {
    // Check if the CURRENT message is the LAST one in the window. If the
    // current message is not returned by the recent window, do not silence BIA:
    // clock drift, slow inserts, or metadata inconsistencies should not make
    // the assistant miss an actual customer request.
    const currentIndex = recentMsgs.findIndex((m: any) => m.metadata?.message_id === currentMessageId);
    if (currentIndex === -1) {
      console.warn("Debounce: current message not found in recent window; replying with current text.", currentMessageId);
      return { text: currentText, isLatest: true };
    }

    const isLatest = currentIndex === recentMsgs.length - 1;

    if (recentMsgs.length > 1) {
      const combined = recentMsgs.map((m: any) => m.content).join("\n");
      if (isLatest) {
        console.log("Debounce: combined", recentMsgs.length, "messages.");
      }
      return { text: combined, isLatest };
    }
    
    return { text: currentText, isLatest };
  }

  return { text: currentText, isLatest: true };
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
    idFull: p.id,
    statusRaw: p.status,
    status: statusMap[p.status] || p.status,
    valor: p.valor_total,
  };
}

// ========== CANCEL ORDER ==========
export async function cancelOrder(
  supabase: any,
  pedidoId: string,
  clienteId: string | null,
  motivo: string,
): Promise<{ ok: boolean; reason?: string; status?: string }> {
  if (!pedidoId) return { ok: false, reason: "missing_id" };

  const { data: pedido, error } = await supabase.from("pedidos")
    .select("id, status, cliente_id, observacoes")
    .eq("id", pedidoId).maybeSingle();

  if (error || !pedido) return { ok: false, reason: "not_found" };
  if (clienteId && pedido.cliente_id && pedido.cliente_id !== clienteId) {
    return { ok: false, reason: "not_owner" };
  }
  const blocked = ["entregue", "cancelado", "saiu_entrega"];
  if (blocked.includes(pedido.status)) {
    return { ok: false, reason: "status_blocked", status: pedido.status };
  }

  const obs = `${pedido.observacoes ? pedido.observacoes + "\n" : ""}[Cancelado pela Bia em ${new Date().toISOString()}] Motivo: ${motivo || "não informado"}`;
  const { error: updErr } = await supabase.from("pedidos")
    .update({ status: "cancelado", observacoes: obs })
    .eq("id", pedidoId);

  if (updErr) {
    console.error("cancelOrder update error:", updErr);
    return { ok: false, reason: "update_failed" };
  }
  return { ok: true };
}

// ========== PROCESS CANCEL TAG (helper for webhooks) ==========
export function parseCancelTag(reply: string): { pedido_id: string; motivo: string } | null {
  const m = reply.match(/\[CANCELAR_PEDIDO\]([\s\S]*?)\[\/CANCELAR_PEDIDO\]/);
  if (!m) return null;
  const block = m[1];
  const idMatch = block.match(/pedido_id:\s*([0-9a-f-]{8,})/i);
  const motMatch = block.match(/motivo:\s*([^\n]+)/i);
  return {
    pedido_id: (idMatch?.[1] || "").trim(),
    motivo: (motMatch?.[1] || "não informado").trim(),
  };
}

export function stripCancelTag(reply: string): string {
  return reply.replace(/\[CANCELAR_PEDIDO\][\s\S]*?\[\/CANCELAR_PEDIDO\]/g, "").trim();
}

// Process the cancel tag in an AI reply, executing the cancellation in DB.
// Returns the cleaned reply (tag removed) plus a flag.
export async function processCancelTagInReply(
  supabase: any,
  reply: string,
  clienteId: string | null,
): Promise<{ reply: string; cancelled: boolean; reason?: string }> {
  const parsed = parseCancelTag(reply);
  if (!parsed) return { reply, cancelled: false };
  const cleaned = stripCancelTag(reply);
  if (!parsed.pedido_id) return { reply: cleaned, cancelled: false, reason: "missing_id" };
  const result = await cancelOrder(supabase, parsed.pedido_id, clienteId, parsed.motivo);
  if (!result.ok) {
    console.error("Bia cancel failed:", result.reason, parsed);
    const fallback = result.reason === "status_blocked"
      ? `${cleaned}\n\n(Aviso: o pedido já está ${result.status} e não pode mais ser cancelado pelo sistema. A equipe foi avisada.)`
      : `${cleaned}\n\n(Aviso: não consegui cancelar agora. A equipe foi avisada.)`;
    return { reply: fallback, cancelled: false, reason: result.reason };
  }
  return { reply: cleaned, cancelled: true };
}

// ========== PRODUCTS ==========
export async function getProducts(supabase: any, unidadeId: string | null, config?: BiaConfig | null) {
  let q = supabase.from("produtos").select("nome, preco, estoque, categoria")
    .eq("ativo", true).gt("estoque", 0).order("nome").limit(15);
  if (unidadeId) q = q.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

  const { data } = await q;
  if (!data?.length) return "Produtos indisponíveis no momento.";

  // Filter by categorias_permitidas from regras_bia
  let allowedCategories: string[] | null = null;
  if (unidadeId) {
    const { data: u } = await supabase.from("unidades").select("empresa_id").eq("id", unidadeId).maybeSingle();
    if (u?.empresa_id) {
      const { data: configEmpresa } = await supabase.from("configuracoes_empresa")
        .select("regras_bia").eq("empresa_id", u.empresa_id).maybeSingle();
      const regras = configEmpresa?.regras_bia;
      if (regras?.categorias_permitidas?.length) {
        allowedCategories = regras.categorias_permitidas;
      }
    }
  }

  if (config?.tabelaPrecos) {
    const tp = config.tabelaPrecos;
    const items = [];
    if (tp.gas_p13?.preco) items.push(`- Gás P13: R$ ${tp.gas_p13.preco.toFixed(2)}`);
    if (tp.gas_p20?.preco) items.push(`- Gás P20: R$ ${tp.gas_p20.preco.toFixed(2)}`);
    if (tp.gas_p45?.preco) items.push(`- Gás P45: R$ ${tp.gas_p45.preco.toFixed(2)}`);
    if (tp.agua_20l?.preco) items.push(`- Água Mineral 20L: R$ ${tp.agua_20l.preco.toFixed(2)}`);
    if (items.length) return items.join("\n");
  }

  const filtered = allowedCategories
    ? data.filter((p: any) => !p.categoria || allowedCategories!.includes(p.categoria))
    : data;

  return filtered.length
    ? filtered.map((p: any) => `- ${p.nome}: R$ ${Number(p.preco).toFixed(2)}`).join("\n")
    : "Produtos indisponíveis no momento.";
}

// ========== EXTRACT COLLECTED DATA FROM HISTORY ==========
export function extractCollectedData(history: any[]): { pagamento?: string; produto?: string; enderecoConfirmado?: boolean; clienteInstitucional?: boolean; skipPagamentoValor?: boolean } {
  const result: { pagamento?: string; produto?: string; enderecoConfirmado?: boolean; clienteInstitucional?: boolean; skipPagamentoValor?: boolean } = {};

  // 1. Extração via [STATE] gerado pela IA (Structured Output)
  const assistantMsgs = history.filter((m: any) => m.role === "assistant");
  if (assistantMsgs.length > 0) {
    const lastMsg = assistantMsgs[assistantMsgs.length - 1].content;
    const match = lastMsg.match(/\[STATE\]([\s\S]*?)\[\/STATE\]/i);
    if (match) {
      try {
        const parsedState = JSON.parse(match[1].trim());
        if (parsedState.produto) result.produto = parsedState.produto;
        if (parsedState.pagamento) result.pagamento = parsedState.pagamento;
        if (parsedState.enderecoConfirmado === true) result.enderecoConfirmado = true;
      } catch (e) {
        console.error("Falha ao parsear STATE JSON", e);
      }
    }
  }

  // 2. Fallback: Scan user messages for institutional / payment / product IF NOT defined by STATE
  const userMsgs = history.filter((m: any) => m.role === "user");
  for (const msg of userMsgs) {
    const t = msg.content.toLowerCase();

    // Detect institutional client (always active to skip price steps immediately)
    if (!result.clienteInstitucional && /\b(escola|col[eé]gio|creche|emei|emef|ubs|posto\s*de\s*sa[uú]de|pol[ií]cia|secretaria|assist[eê]ncia\s*social|prefeitura|damasco|municipal|estadual)\b/i.test(t)) {
      result.clienteInstitucional = true;
      result.pagamento = "institucional";
      result.skipPagamentoValor = true;
    }

    if (!result.pagamento) {
      if (/\b(dinheiro|em\s*dinheiro)\b/i.test(t)) result.pagamento = "dinheiro";
      else if (/\bpix\b/i.test(t)) result.pagamento = "pix";
      else if (/\b(cart[aã]o|cartao|débito|credito|crédito)\b/i.test(t)) result.pagamento = "cartão";
      else if (/\bfiad[oa]?\b/i.test(t)) result.pagamento = "fiado";
      else if (/\b(vale\s*g[aá]s|vale)\b/i.test(t)) {
        result.pagamento = "vale gás";
        result.skipPagamentoValor = true;
      }
    }
    if (!result.produto) {
      if (/\bp\s*13\b/i.test(t) || /\bgás\b/i.test(t) || /\bgas\b/i.test(t) || /\bbotij/i.test(t)) result.produto = "Gás P13";
      else if (/\bp\s*20\b/i.test(t)) result.produto = "Gás P20";
      else if (/\bp\s*45\b/i.test(t)) result.produto = "Gás P45";
      else if (/\b(água|agua|mineral|gal[aã]o|20\s*l)/i.test(t)) result.produto = "Água Mineral 20L";
    }
  }

  return result;
}

// ========== DETECT CONVERSATION STEP ==========
function detectCurrentStep(history: any[], collected: { pagamento?: string; produto?: string; enderecoConfirmado?: boolean; skipPagamentoValor?: boolean }): { step: number; label: string } {
  if (!history || history.length === 0) return { step: 1, label: "Passo 1 (saudação inicial)" };

  const hasGreeting = history.some((m: any) => m.role === "assistant" && /ol[aá]|bom dia|boa tarde|boa noite|como posso ajudar/i.test(m.content));

  // For institutional/vale gás: skip payment step entirely
  if (collected.skipPagamentoValor) {
    if (collected.produto && collected.enderecoConfirmado) {
      return { step: 5, label: "Passo 5 (registrar pedido — cliente institucional/vale gás, pular pagamento e valor)" };
    }
    if (collected.produto) {
      return { step: 3, label: "Passo 3 (confirmar endereço de entrega — pagamento não necessário)" };
    }
  }

  if (collected.enderecoConfirmado && collected.produto && collected.pagamento) {
    return { step: 5, label: "Passo 5 (registrar pedido — todos os dados confirmados)" };
  }
  if (collected.enderecoConfirmado && collected.produto) {
    return { step: 4, label: "Passo 4 (perguntar forma de pagamento)" };
  }
  if (collected.produto) {
    return { step: 3, label: "Passo 3 (confirmar endereço de entrega)" };
  }
  if (hasGreeting) {
    return { step: 2, label: "Passo 2 (aguardar cliente pedir produto)" };
  }
  return { step: 1, label: "Passo 1 (saudação inicial)" };
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
  negotiationHint: string,
  sundayContext?: { isSunday: boolean; waterDeliveryAllowed: boolean },
  history?: any[],
  gasDoPovoConfig?: { entrega: boolean; taxa: number },
  contactIdentity?: ContactIdentity,
  unidadeLocation?: { cidade: string | null; estado: string | null; bairros: string[]; empresaNome?: string | null; endereco?: string | null; bairro?: string | null; cep?: string | null }
): string {
  const agentName = config.agentName || "Bia";
  const empresaNome = unidadeLocation?.empresaNome || null;
  const empresaLabel = empresaNome ? `da ${empresaNome}` : "da empresa de gás";
  const now = new Date();
  const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
  const hour = brt.getHours();
  const saudacao = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";

  // Extract collected data and detect step
  const collected = extractCollectedData(history || []);
  const currentStep = detectCurrentStep(history || [], collected);

  // Build collected data section
  let collectedSection = "";
  const collectedItems: string[] = [];
  if (collected.produto) collectedItems.push(`- Produto: ${collected.produto}`);
  if (collected.enderecoConfirmado) collectedItems.push(`- Endereço: CONFIRMADO pelo cliente`);
  if (collected.pagamento) collectedItems.push(`- Pagamento: ${collected.pagamento}`);

  if (collectedItems.length > 0) {
    collectedSection = `\n\nDADOS JÁ INFORMADOS PELO CLIENTE (NÃO pergunte novamente):\n${collectedItems.join("\n")}`;
  }

  // Finalize immediately if all data present (or institutional/vale gás skips payment)
  let finalizeHint = "";
  if (collected.produto && collected.enderecoConfirmado && collected.pagamento) {
    finalizeHint = "\n\n⚠️ TODOS OS DADOS FORAM COLETADOS. FINALIZE O PEDIDO IMEDIATAMENTE gerando a tag [PEDIDO_CONFIRMADO]. NÃO faça mais perguntas.";
  }
  if (collected.skipPagamentoValor && collected.produto && collected.enderecoConfirmado) {
    finalizeHint = "\n\n⚠️ CLIENTE INSTITUCIONAL OU VALE GÁS — TODOS OS DADOS COLETADOS. FINALIZE O PEDIDO IMEDIATAMENTE com pagamento '" + collected.pagamento + "' e valor: 0. Gere a tag [PEDIDO_CONFIRMADO] AGORA.";
  }

  // 🚫 BLOQUEIO DE PEDIDO DUPLICADO: se já existe pedido ativo, NUNCA reabrir fluxo de venda
  if (orderStatus && orderStatus.statusRaw !== "entregue" && orderStatus.statusRaw !== "cancelado") {
    finalizeHint = `\n\n🚫 PEDIDO JÁ EM ANDAMENTO (#${orderStatus.id}, ${orderStatus.status}, R$ ${orderStatus.valor}).\n- NÃO gere a tag [PEDIDO_CONFIRMADO] nesta conversa. O pedido já foi registrado.\n- Se o cliente perguntar "já saiu?", "cadê?", "demora?", "obrigado", "sim", "ok" → apenas confirme o status atual de forma curta e gentil.\n- Só reabra um novo fluxo de venda se o cliente disser EXPLICITAMENTE que quer um NOVO pedido (ex: "quero outro botijão", "preciso de mais um").`;
  }

  // If contact is entregador or parceiro, return specialized prompt
  if (contactIdentity?.tipo === "entregador") {
    return `Você é a ${agentName}, assistente virtual ${empresaLabel}.

CONTEXTO: Você está conversando com o ENTREGADOR ${contactIdentity.nome || "da equipe"}. Ele faz parte da equipe de entregas.

REGRAS:
- Responda de forma DIRETA e OBJETIVA, como colega de trabalho.
- Pode informar sobre entregas pendentes, horários, rotas e questões operacionais.
- NÃO tente vender produtos. NÃO siga o fluxo de pedido de clientes.
- NÃO peça endereço, forma de pagamento ou dados de venda.
- Se ele perguntar algo que você não sabe, diga para falar com o gerente ou escritório.
- Seja prestativo e breve nas respostas.

${orderStatus ? `PEDIDOS EM ANDAMENTO:\n- Pedido #${orderStatus.id}: ${orderStatus.status} (R$ ${orderStatus.valor})` : ""}`;
  }

  if (contactIdentity?.tipo === "parceiro") {
    return `Você é a ${agentName}, assistente virtual ${empresaLabel}.

CONTEXTO: Você está conversando com o PARCEIRO INSTITUCIONAL ${contactIdentity.nome || ""}.

REGRAS:
- Responda de forma EDUCADA e PROFISSIONAL.
- Pode informar sobre pedidos pendentes da instituição.
- Se ele quiser fazer um pedido, trate como pedido institucional (sem cobrar valor).
- NÃO siga o fluxo de venda normal para clientes finais.
- Seja prestativo e breve nas respostas.
- Se precisar de algo que você não consegue resolver, oriente a entrar em contato com o escritório.`;
  }

  // Check delivery area
  let deliveryAreaHint = "";
  
  // Detect dissatisfaction from last user message
  const lastUserMsg = (history || []).filter((m: any) => m.role === "user").pop()?.content || "";
  const isDissatisfied = detectDissatisfaction(lastUserMsg);
  let dissatisfactionHint = "";
  if (isDissatisfied) {
    dissatisfactionHint = `\n\n⚠️ DETECÇÃO DE INSATISFAÇÃO: O cliente demonstrou frustração ou insatisfação.
REGRAS OBRIGATÓRIAS:
- Adote tom EMPÁTICO e ACOLHEDOR imediatamente
- Peça desculpas sinceramente: "Sinto muito pelo transtorno..."
- Ofereça solução concreta quando possível
- NÃO seja defensivo, NÃO minimize o problema
- Se for reclamação de entrega, ofereça verificar o status
- Se for reclamação de preço, explique com educação e ofereça o melhor preço disponível
- Marque internamente como insatisfação para acompanhamento`;
  }

  // Área de atendimento (cidade/estado da unidade)
  let areaAtendimentoSection = "";
  if (unidadeLocation?.cidade) {
    const cidadeEstado = unidadeLocation.estado
      ? `${unidadeLocation.cidade}/${unidadeLocation.estado}`
      : unidadeLocation.cidade;
    const bairrosTxt = unidadeLocation.bairros.length > 0
      ? `\n- Bairros atendidos: ${unidadeLocation.bairros.join(", ")}.`
      : "";
    areaAtendimentoSection = `\n\n🚨 ÁREA DE ATENDIMENTO (REGRA ABSOLUTA — NUNCA QUEBRE):
- A loja atende SOMENTE em ${cidadeEstado} e região imediata.${bairrosTxt}
- Se o cliente perguntar se atende OUTRA cidade, OUTRO estado ou OUTRO município (ex: "atende Rio Grande do Sul?", "entrega em São Paulo?", "vocês vão até Curitiba?"):
  → Responda EDUCADAMENTE que NÃO: "Que pena! Atendemos somente ${cidadeEstado} e região. Não conseguimos entregar aí. 😔"
  → NUNCA confirme entrega fora de ${cidadeEstado}.
  → NÃO invente cobertura. NÃO prometa o que não pode cumprir.
- Se o endereço informado pelo cliente for claramente de outra cidade/estado, recuse a entrega com gentileza.`;
  }

  // Endereço REAL da loja/unidade
  let enderecoLojaSection = "";
  if (unidadeLocation?.endereco) {
    const parts = [
      unidadeLocation.endereco,
      unidadeLocation.bairro,
      unidadeLocation.cep ? `CEP ${unidadeLocation.cep}` : null,
    ].filter(Boolean);
    const enderecoLoja = parts.join(", ");
    enderecoLojaSection = `\n\n📍 ENDEREÇO DA LOJA (USE EXATAMENTE ESTE ENDEREÇO):
- Endereço da loja: ${enderecoLoja}
- Se o cliente perguntar o endereço/horário da loja para retirada, informe SOMENTE este endereço acima e o horário de funcionamento.
- NUNCA invente outro endereço. NUNCA misture com endereços de outras filiais.`;
  }

  return `Você é a ${agentName}, atendente virtual de vendas de gás ${empresaLabel}. Seu atendimento deve ser CALOROSO, HUMANO e NATURAL — como uma atendente simpática de verdade, não um robô.

⚠️ IDENTIFICAÇÃO (CRÍTICO — UMA ÚNICA VEZ):
- Apresente-se ("Aqui é a ${agentName} da ${empresaNome || "loja"}") APENAS na PRIMEIRA mensagem da conversa, quando ainda não há histórico de mensagens suas.
- Se o histórico já contém QUALQUER mensagem sua (assistant), NUNCA mais se apresente, NUNCA mais diga "Aqui é a ${agentName}", NUNCA mais cite o nome da loja em saudação. Apenas responda direto ao que o cliente disse.
- Nas mensagens seguintes, fale como uma atendente que já está na conversa: respostas curtas, naturais, sem reabrir saudações.${areaAtendimentoSection}${enderecoLojaSection}

PERSONALIDADE:
- Seja ACOLHEDORA e SIMPÁTICA, use emojis com moderação (1-2 por mensagem)
- Converse como uma pessoa real: use expressões naturais como "claro!", "com certeza!", "sem problemas!"
- Demonstre interesse genuíno pelo cliente: "Tudo bem com você?", "Como vai?"
- Se o cliente fizer conversa casual (Oi, Olá, Bom dia), RESPONDA com calor humano antes de qualquer coisa sobre pedidos
- NUNCA pule direto para perguntas sobre produto ou endereço na primeira mensagem

ANTI-REPETIÇÃO (CRÍTICO — SIGA À RISCA):
- Se o histórico já contém sua saudação (Olá, Bom dia, Oi, Boa tarde, etc.), NÃO cumprimente de novo. Responda direto.
- NUNCA repita "Aqui é a ${agentName}", "da ${empresaNome || "loja"}", ou apresentação em mensagens seguintes.
- Se o cliente já disse o que quer (gás, água, etc.), NÃO pergunte "como posso ajudar". Avance para confirmar endereço.
- NUNCA repita a mesma mensagem, pergunta ou frase de abertura duas vezes na conversa.
- Leia o histórico completo antes de responder — se já perguntou ou disse algo, NÃO repita.
- Se o cliente informou forma de pagamento, NÃO pergunte novamente.
- Varie as palavras: se já disse "Tudo bem?", não repita; siga a conversa.

ETAPA ATUAL DA CONVERSA: ${currentStep.label}. NÃO volte a passos anteriores.${collectedSection}${finalizeHint}${dissatisfactionHint}

REGRAS DE OURO:
1. NÃO FINALIZAR PEDIDOS AUTOMATICAMENTE: Mesmo que o cliente já seja conhecido, NUNCA crie ou confirme um pedido no início da conversa.
2. ESPERAR O PEDIDO: Na primeira mensagem, APENAS cumprimente pelo nome de forma calorosa. NÃO mencione endereço, NÃO mencione produto, NÃO pergunte o que deseja. Espere o cliente dizer espontaneamente que quer gás ou água.
3. PREÇO RÍGIDO: O valor a ser registrado no sistema deve ser EXATAMENTE o valor que você informou ao cliente na conversa.
4. STATE OBRIGATÓRIO (CRÍTICO): VOCÊ DEVE OBRIGATORIAMENTE incluir a tag [STATE] no final de TODAS as suas respostas (em uma nova linha), contendo o estado atual do pedido em JSON.
   Exemplo:
   Sua resposta para o cliente... 😊
   [STATE] {"produto": "Gás P13", "enderecoConfirmado": true, "pagamento": "dinheiro"} [/STATE]
   Seja inteligente: se o cliente disser "isso", "pode mandar", "aqui mesmo", mude "enderecoConfirmado" para true. Se não tiver uma informação, omita-a do JSON.

⚠️ REGRA CRÍTICA DE SAUDAÇÃO:
- Quando o cliente diz "Oi", "Olá", "Bom dia", "Boa tarde" ou qualquer saudação SIMPLES (sem pedir produto):
  → Responda APENAS com saudação calorosa. Exemplo: "${saudacao}, ${cliente.nome ? cliente.nome.split(" ")[0] : ""}! Tudo bem com você? 😊"
  → NÃO pergunte "o que deseja?", NÃO mencione endereço, NÃO fale de produto.
  → PARE e espere o cliente falar o que precisa.
- SOMENTE quando o cliente mencionar gás, água, botijão, pedido ou produto, avance para o Passo 2.

FLUXO OBRIGATÓRIO (NÃO PULE ETAPAS):
Passo 1 – SAUDAÇÃO (APENAS UMA VEZ): ${cliente.nome ? `"${saudacao}, ${cliente.nome.split(" ")[0]}! Tudo bem? 😊" — PARE AQUI. Não pergunte sobre pedido. Espere o cliente dizer o que precisa.` : `"${saudacao}! 👋 Aqui é a ${agentName} da ${empresaNome || "loja"}, tudo bem?" (SÓ na PRIMEIRA mensagem da conversa. Se já houver mensagem sua no histórico, NÃO se apresente de novo — responda direto.)`}
   • Se o cliente responder a saudação ("td bem?", "tudo bem e vc?", "oi"), responda curto e natural ("Tudo ótimo por aqui! 😊" ou "Tudo bem, e você?") SEM se apresentar de novo, SEM repetir nome da loja.
Passo 2 – CLIENTE PEDE PRODUTO ("quero um gás", "manda um gás", "preciso de gás", "quero água"): NÃO informe valor/preço espontaneamente. Responda curto e peça o endereço. Exemplo: "Claro! Qual o endereço para entrega?"
Passo 3 – CLIENTE INFORMA ENDEREÇO: Analise o que veio.
   • Se tem rua + número + bairro/referência → confirme e siga: "Perfeito. Vou enviar seu pedido agora. Qual a forma de pagamento?"
   • Se falta APENAS o número → "Me passa o número da casa, por favor?"
   • Se falta APENAS bairro/referência → "Qual o bairro ou ponto de referência?"
   • ${cliente.endereco ? `Se o cliente não informar endereço novo e já tem cadastrado, confirme: "Entrego lá na ${cliente.endereco}?"` : `Se for cliente novo sem endereço, pergunte uma vez.`}
   • NÃO repita perguntas já respondidas. NÃO peça CEP, complemento ou outros campos.
Passo 4 – FORMA DE PAGAMENTO: Aceite "dinheiro", "pix", "cartão", "débito", "crédito", "vale gás". Não liste opções; espere a resposta.
Passo 5 – CONFIRMAR PEDIDO: Responda EXATAMENTE algo curto como: "Combinado! Seu pedido foi confirmado e já vou passar para entrega." (Pode variar a frase, mas mantenha curto, humano e simpático. NÃO repita produto, endereço, valor ou forma de pagamento na mensagem ao cliente.)

⚠️ REGRA DE PREÇO (CRÍTICO):
- NUNCA informe valor/preço de produto espontaneamente.
- SÓ informe preço quando o cliente perguntar EXPLICITAMENTE: "qual valor?", "quanto está?", "quanto custa?", "preço do gás?", "tá quanto?", "valor?".
- Quando perguntar, responda curto. Exemplo: "O P13 está R$ ${(() => { const m = productList.match(/P13[^\d]*R\$\s*([\d.,]+)/i); return m ? m[1] : "[VALOR]"; })()}." (Use o preço EXATO do catálogo abaixo.)
- "Quero um gás" / "manda um gás" NÃO é pergunta de preço — apenas peça o endereço.

⚠️ ESTILO DA RESPOSTA (CRÍTICO):
- Máximo 1-2 linhas curtas. Tom humano, simpático e direto, como atendente real.
- NÃO mande resumos técnicos, NÃO repita dados do pedido, NÃO explique processos internos.
- NÃO envie blocos, listas longas, marcadores ou cabeçalhos para o cliente.


GÁS DO POVO (CRÍTICO — SIGA À RISCA):
- Se o cliente mencionar "Gás do Povo", "gas do povo", "programa do governo", "voucher do gás", "cartão gás do povo" ou qualquer variação:
${gasDoPovoConfig?.entrega
  ? `  → Informe que o Gás do Povo pode ser RETIRADO NA PORTARIA sem taxa, OU ENTREGUE com taxa de R$ ${gasDoPovoConfig.taxa.toFixed(2)}.
  → Pergunte: "Você prefere retirar na portaria sem taxa ou quer que entregue com taxa de R$ ${gasDoPovoConfig.taxa.toFixed(2)}?"
  → Se escolher RETIRADA: confirme que pode buscar na portaria no horário de funcionamento. NÃO crie pedido de entrega.
  → Se escolher ENTREGA: prossiga com o fluxo normal de pedido, adicionando a taxa de R$ ${gasDoPovoConfig.taxa.toFixed(2)} ao valor.
  → Registre o pagamento como "Gás do Povo" em ambos os casos.`
  : `  → Informe IMEDIATAMENTE: "O Gás do Povo é somente para retirada na portaria da loja, não fazemos entrega desse programa. Você pode vir buscar aqui! 😊"
  → NÃO crie pedido de entrega para Gás do Povo.`}
  → Se o cliente quiser comprar gás normal (P13) com entrega, prossiga normalmente com o fluxo de venda.
  → Se o cliente perguntar o endereço/horário da loja, informe que pode retirar no horário de funcionamento.

CLIENTES INSTITUCIONAIS E VALE GÁS (CRÍTICO — SIGA À RISCA):
- Se o cliente mencionar QUALQUER uma dessas palavras: escola, colégio, creche, EMEI, EMEF, UBS, posto de saúde, polícia, secretaria, assistência social, prefeitura, Damasco, municipal, estadual:
  → Reconheça IMEDIATAMENTE como cliente institucional.
  → NÃO pergunte forma de pagamento.
  → NÃO informe valor/preço do produto.
  → Se o nome/endereço já está cadastrado, confirme: "Entrego sim, [Nome da instituição], [Endereço cadastrado]? Já vou repassar para o entregador."
  → Se NÃO está cadastrado, peça só o endereço: "Entrego sim! Me confirme o endereço de entrega."
  → Registre o pedido com pagamento "institucional" e valor: 0.
- Se o cliente informar que vai pagar com VALE GÁS:
  → NÃO informe valor/preço do produto.
  → Após confirmar endereço, registre o pedido IMEDIATAMENTE com pagamento "vale gás" e valor: 0.

ENDEREÇO FRAGMENTADO (IMPORTANTE):
- O cliente pode enviar o endereço em VÁRIAS mensagens separadas (ex: "Rua Goiás" numa mensagem, "número 500" na próxima, "bairro Centro" depois).
- JUNTE todas as informações de localização do histórico para montar o endereço completo.
- Aceite QUALQUER formato: rua + número, nome de local, ponto de referência, bairro.
- NÃO exija formato rígido. Se tem rua e número, é suficiente.
- Se falta apenas o número ou bairro, pergunte de forma natural: "Qual o número?"

RESPOSTAS CURTAS E OBJETIVAS:
- Responda em no máximo 2-3 linhas.
- Seja direto e humano, como se fosse uma atendente real.
- NÃO use listas longas ou textos explicativos desnecessários.

CANCELAMENTO DE PEDIDO (CRÍTICO — NUNCA MANDE LIGAR PARA A EMPRESA):
- Se o cliente pedir para cancelar ("cancela", "quero cancelar", "desistir", "não quero mais", "anula meu pedido"):
  ${orderStatus && orderStatus.statusRaw !== "saiu_entrega" && orderStatus.statusRaw !== "entregue"
    ? `→ Pedido ativo: #${orderStatus.id} (${orderStatus.status}, R$ ${orderStatus.valor}).
  → 1ª tentativa (RETER COM EMPATIA): Pergunte o motivo de forma gentil. Ex: "Poxa, aconteceu alguma coisa? Posso te ajudar a resolver? 😊"
  → 2ª tentativa (OFERECER SOLUÇÃO conforme o motivo):
     • Demora → "Posso falar agora com o entregador para agilizar! Quer que eu peça prioridade?"
     • Preço → ofereça desconto dentro das regras de negociação (ver bloco de NEGOCIAÇÃO).
     • Mudou de ideia / não precisa mais → "Sem problemas, mas posso deixar agendado para outro horário, fica mais fácil?"
  → 3ª resposta — se o cliente AINDA insistir em cancelar: confirme UMA ÚLTIMA VEZ. Ex: "Tudo bem! Confirma que quer cancelar o pedido #${orderStatus.id} de R$ ${orderStatus.valor}?"
  → Quando o cliente confirmar ("sim", "pode cancelar", "isso", "confirma"): responda algo curto como "Pronto! Cancelei aqui pra você. Qualquer coisa é só chamar! 😊" e GERE A TAG ABAIXO no FINAL da mensagem:
  [CANCELAR_PEDIDO]
  pedido_id: ${orderStatus.idFull}
  motivo: <resumo curto do motivo informado pelo cliente>
  [/CANCELAR_PEDIDO]
  → NUNCA diga "ligue para a empresa", "fale com o escritório" ou "entre em contato com a loja" para cancelar. VOCÊ resolve.`
    : orderStatus
      ? `→ O pedido já saiu para entrega / foi entregue. NESSE caso explique gentilmente: "Seu pedido já está a caminho/entregue, não consigo cancelar pelo sistema. Vou avisar a equipe agora mesmo, tá?" e NÃO gere a tag de cancelamento.`
      : `→ NÃO há pedido ativo. Responda: "Não encontrei nenhum pedido em andamento no seu cadastro. Posso te ajudar com mais alguma coisa? 😊"`}

PRODUTOS E PREÇOS DISPONÍVEIS:
${productList}

DADOS TÉCNICOS (SÓ GERE APÓS O PASSO 5):
[PEDIDO_CONFIRMADO]
nome: ${cliente.nome || "Cliente"}
produto: (Nome EXATO: "Gás P13", "Gás P20", "Gás P45" ou "Água Mineral 20L")
quantidade: 1
endereco: Endereço completo
pagamento: forma escolhida (ou "institucional" / "vale gás")
valor: NÚMERO TOTAL do pedido (preço × quantidade, já com qualquer desconto que VOCÊ ofereceu). Use EXATAMENTE o valor que você falou ao cliente nesta conversa. Ex.: se você disse "R$ 125,00", escreva 125. Use 0 SOMENTE se for institucional ou vale gás. Em caso de dúvida, multiplique o preço da tabela acima pela quantidade.
telefone: ${normalized}
[/PEDIDO_CONFIRMADO]

${isOffHours ? `FORA DO HORÁRIO (${horarioInfo}): Informe fechamento e ofereça agendamento.` : ""}
${negotiationHint}
${deliveryAreaHint}`;
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

  const askingPrice = /(?:faz|fazer|pode|consegue|consegui|aceita)\s*(?:por\s*)?r?\$?\s*\d+/i.test(messageText);
  
  const isWaterMode = history.some(m => /água|agua|mineral|20\s*l/i.test(m.content.toLowerCase())).toString() === "true";

  if (isWaterMode && !messageText.toLowerCase().includes("gás") && !messageText.toLowerCase().includes("gas")) {
    return ""; // No negotiation hints for water if it's clearly defined
  }

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
  // Only load messages from the last 2 hours to avoid stale context from old conversations
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("ai_mensagens")
    .select("role, content, created_at").eq("conversa_id", conversationId)
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: true }).limit(20);
  return data ? data.map((m: any) => ({ role: m.role, content: m.content })) : [];
}

export async function saveMessage(supabase: any, conversationId: string, role: string, content: string, metadata?: any) {
  const wa_message_id = metadata?.message_id || metadata?.wa_message_id || null;
  const row: any = { conversa_id: conversationId, role, content, metadata };
  if (wa_message_id) row.wa_message_id = wa_message_id;
  if (role === "user") row.status = "sent";
  else if (role === "assistant" || role === "system") row.status = "sent";

  // Set tenant fields explicitly so RLS/Realtime can deliver the message to
  // the right company/unit even if the DB trigger is delayed or unavailable.
  try {
    const { data: conv } = await supabase
      .from("ai_conversas")
      .select("empresa_id, unidade_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conv?.empresa_id) row.empresa_id = conv.empresa_id;
    if (conv?.unidade_id) row.unidade_id = conv.unidade_id;
  } catch (_) { /* DB trigger remains as fallback */ }

  const { error } = await supabase.from("ai_mensagens").insert(row);
  if (error) {
    console.error("[bia-core] saveMessage failed", {
      conversationId,
      role,
      wa_message_id,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw error;
  }

  try {
    await supabase
      .from("ai_conversas")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  } catch (e) {
    console.warn("[bia-core] failed to touch conversation after message insert", conversationId, e);
  }
}

export async function upsertConversation(supabase: any, conversationId: string, title: string, telefone?: string, unidadeId?: string | null) {
  // Se já existe uma conversa com título genérico ("Cliente", "WhatsApp: Cliente", só dígitos), substituir pelo novo title
  let finalTitle = title;
  try {
    const { data: existing } = await supabase.from("ai_conversas").select("titulo").eq("id", conversationId).maybeSingle();
    const oldTitle = (existing?.titulo || "").trim();
    const isOldGeneric = !oldTitle || /^(whatsapp:\s*)?(cliente(\s*whatsapp)?|unknown|\+?\d{8,})$/i.test(oldTitle);
    const isNewGeneric = /^(whatsapp:\s*)?(cliente(\s*whatsapp)?|unknown|\+?\d{8,})$/i.test(title.trim());
    // Mantém título atual se o novo for genérico e o antigo for melhor
    if (!isOldGeneric && isNewGeneric) finalTitle = oldTitle;
  } catch {}

  const payload: any = {
    id: conversationId,
    user_id: "00000000-0000-0000-0000-000000000000",
    titulo: finalTitle,
    updated_at: new Date().toISOString(),
  };
  if (telefone) payload.telefone = telefone;
  if (unidadeId) {
    payload.unidade_id = unidadeId;
    try {
      const { data: unidade } = await supabase.from("unidades").select("empresa_id").eq("id", unidadeId).maybeSingle();
      if (unidade?.empresa_id) payload.empresa_id = unidade.empresa_id;
    } catch {}
  }
  const { error } = await supabase.from("ai_conversas").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("[bia-core] upsertConversation failed", {
      conversationId,
      unidadeId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw error;
  }
}

// ========== IDEMPOTENCY ==========
export async function isDuplicate(supabase: any, conversationId: string, messageKey: string): Promise<boolean> {
  const { data } = await supabase.from("ai_mensagens").select("id")
    .eq("conversa_id", conversationId).eq("role", "user")
    .contains("metadata", { message_id: messageKey }).limit(1);
  return !!(data && data.length > 0);
}

// ========== POST-ORDER FOLLOW-UP CHECK ==========
export async function isPostOrderFollowUp(supabase: any, phone: string, messageText: string): Promise<boolean | "rating"> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("pedidos").select("id, cliente_id, entregador_id, status")
    .eq("canal_venda", "whatsapp").gte("created_at", twoHoursAgo)
    .ilike("observacoes", `%(${phone})%`).limit(1);

  if (!data?.length) return false;

  const trimmed = messageText.trim();
  
  // Check for rating response (1-5 or star emojis)
  const ratingMatch = trimmed.match(/^([1-5])$/);
  const starMatch = trimmed.match(/^(⭐+)$/);
  const rating = ratingMatch ? parseInt(ratingMatch[1]) : starMatch ? starMatch[1].length : null;
  
  if (rating && rating >= 1 && rating <= 5) {
    // Save rating
    const pedido = data[0];
    try {
      await supabase.from("avaliacoes_entrega").insert({
        pedido_id: pedido.id,
        user_id: pedido.cliente_id || "00000000-0000-0000-0000-000000000000",
        entregador_id: pedido.entregador_id || null,
        nota_entregador: rating,
        nota_produto: rating,
        comentario: `Avaliação via WhatsApp: ${rating}/5`,
      });
      console.log("Rating saved:", rating, "for order:", pedido.id);
    } catch (e) {
      console.error("Rating save error:", e);
    }
    return "rating";
  }

  // Only treat as follow-up if the ENTIRE message is a short acknowledgment (max 3 words)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 3) return false;

  const isNewOrder = /(quero|preciso|novo pedido|pedido|gás|gas|botij|p13|p20|p45|água|agua|comprar|entrega|preço|preco|quanto)/i.test(trimmed);
  const isFollowUp = /^(obrigad[oa]?|valeu|certo|perfeito|show|blz|beleza|tmj|falou|vlw|brigad[oa]?|thanks|thx)$/i.test(trimmed);

  return !isNewOrder && isFollowUp;
}

// ========== CHECK DELIVERY AREA ==========
export async function getDeliveryAreaBairros(supabase: any, unidadeId: string | null): Promise<string[]> {
  if (!unidadeId) return [];
  const { data: rotas } = await supabase.from("rotas_definidas")
    .select("bairros").eq("ativo", true).eq("unidade_id", unidadeId);
  if (!rotas?.length) return [];
  const allBairros: string[] = [];
  for (const r of rotas) {
    if (r.bairros?.length) allBairros.push(...r.bairros);
  }
  return [...new Set(allBairros)];
}

// ========== DETECT DISSATISFACTION ==========
export function detectDissatisfaction(messageText: string): boolean {
  return /\b(demora|demorou|atraso|atrasad[oa]|ru[ií]m|p[eé]ssim[oa]|horrível|horr[ií]vel|absurdo|falta\s*de\s*respeito|lixo|porcaria|nunca\s*mais|reclamação|reclamar|insatisfeit[oa]|raiva|indignado|vergonha|descaso|caro\s*demais|roubo|enganação)\b/i.test(messageText);
}

// ========== AI CALL ==========
export async function callAI(messages: any[]): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  if (!OPENAI_API_KEY && !LOVABLE_API_KEY && !GEMINI_API_KEY) {
    throw new Error("AI_CONFIG_MISSING: Nenhuma chave de IA configurada (GEMINI, OPENAI ou LOVABLE).");
  }

  // Prioridade 1: Gemini Direto (Google AI Studio)
  if (GEMINI_API_KEY) {
    const systemInstruction = messages.find(m => m.role === "system")?.content;
    const history = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const payload: any = { contents: history };
    if (systemInstruction) {
      payload.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const result = await resp.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, tive um problema ao processar via Gemini.";
    }
    console.error("Gemini direct API error:", await resp.text());
  }

  // Prioridade 2: OpenAI
  if (OPENAI_API_KEY) {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages }),
    });
    if (resp.ok) {
      const result = await resp.json();
      return result.choices?.[0]?.message?.content || "Desculpe, tive um problema ao processar via OpenAI.";
    }
  }

  // Prioridade 3: Lovable Gateway
  if (LOVABLE_API_KEY) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      console.error(`Lovable AI Gateway error ${resp.status}:`, errBody.substring(0, 300));
      if (resp.status === 429) throw new Error("RATE_LIMIT");
      if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
      throw new Error(`AI_ERROR_${resp.status}`);
    }

    const result = await resp.json();
    return result.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem pelo gateway.";
  }

  return "Erro de configuração de IA.";
}

// ========== AUDIO TRANSCRIPTION ==========
export async function downloadAudio(config: BiaConfig, mediaUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    let fetchUrl = mediaUrl;
    const headers: Record<string, string> = {};

    // Z-API media URLs need authentication
    if (config.provedor === "meta") {
      // Meta Cloud API media: need to download via graph API with auth
      headers["Authorization"] = `Bearer ${config.token}`;
    } else if (config.provedor === "evolution") {
      // Evolution API media: download using apikey
      headers["apikey"] = config.token;
    } else if (config.provedor === "zapi" && !mediaUrl.startsWith("http")) {
      fetchUrl = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/download-media`;
      headers["Content-Type"] = "application/json";
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
    } else if (config.provedor === "uazapi" && !mediaUrl.startsWith("http")) {
      fetchUrl = `https://free.uazapi.com/chat/downloadMedia`;
      headers["token"] = config.token;
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
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  try {
    // 1. Tenta via Gemini Direto (Suporta áudio nativamente)
    if (GEMINI_API_KEY) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Transcreva este áudio do WhatsApp da forma mais fiel possível." },
              { inline_data: { mime_type: mimeType, data: audioBase64 } }
            ]
          }]
        }),
      });

      if (resp.ok) {
        const result = await resp.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
    }

    const token = LOVABLE_API_KEY || OPENAI_API_KEY;
    if (!token) return null;

    const baseUrl = LOVABLE_API_KEY 
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "gpt-4o-audio-preview";

    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url", // Lovable Gateway uses this schema for any binary (audio/image)
                image_url: { url: `data:${mimeType};base64,${audioBase64}` },
              },
              {
                type: "text",
                text: "Transcreva EXATAMENTE o que a pessoa disse neste áudio. Retorne APENAS a transcrição, sem nenhum comentário ou formatação extra. Se não conseguir entender, retorne 'inaudível'.",
              },
            ],
          },
        ],
        max_tokens: 2000,
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

// ========== PARSE VALOR BR ==========
// Distingue "125", "125,00", "125.00", "1.250,00", "1,250.00"
export function parseValorBR(input: any): number {
  if (input === null || input === undefined) return NaN;
  let s = String(input).replace(/[^\d.,-]/g, "").trim();
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Quem aparece por último é o decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    // Se o ponto vier com 1-2 dígitos depois, é decimal; senão é milhar
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 2 || last.length === 3) s = s.replace(/\./g, "");
    // else mantém o ponto como decimal
  }
  return parseFloat(s);
}

// ========== CREATE ORDER ==========
export async function createOrder(
  supabase: any, orderData: Record<string, string>,
  clienteId: string | null, clienteNome: string | null,
  senderName: string, phone: string, unidadeId: string | null,
  isAgendado = false, fallbackDiscountPerUnit = 0
) {
  try {
    // ===== ANTI-DUPLICATA: pedido ativo nas últimas 2h do mesmo telefone =====
    {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const normPhone = normalizePhone(phone);
      const { data: ativos } = await supabase.from("pedidos")
        .select("id, status, created_at, valor_total")
        .eq("canal_venda", "whatsapp")
        .gte("created_at", twoHoursAgo)
        .in("status", ["pendente", "confirmado", "em_rota", "saiu_entrega", "agendado"])
        .ilike("observacoes", `%(${normPhone})%`)
        .limit(1);
      if (ativos?.length) {
        console.warn("[createOrder] BLOQUEADO: pedido ativo recente já existe", {
          phone: normPhone, pedidoExistente: ativos[0].id, status: ativos[0].status,
        });
        return { pedidoId: ativos[0].id as string, entregadorId: null, duplicado: true } as any;
      }
    }

    // Auto-register client
    if (!clienteId && (orderData.nome || senderName)) {
      const nome = orderData.nome || senderName;
      const norm = normalizePhone(phone);
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

    // Find product — detect category to avoid água ↔ gás confusion
    let produto: any = null;
    const prodName = orderData.produto || "";
    const isWater = /água|agua|mineral|galão|galao|20\s*l/i.test(prodName);
    const isGas = /g[aá]s|P\s*13|P\s*20|P\s*45|botij/i.test(prodName);
    const categoryFilter = isWater ? "agua" : isGas ? "gas" : null;

    // Primary search with category filter
    let query = supabase.from("produtos").select("id, nome, preco, categoria")
      .eq("ativo", true).ilike("nome", `%${prodName}%`);
    if (categoryFilter) query = query.eq("categoria", categoryFilter);
    const { data: prods } = await query.limit(1);
    produto = prods?.[0];

    // Fallback: prioritize patterns with units (20L for water) before bare numbers
    if (!produto) {
      // First try unit-specific patterns
      const unitMatch = prodName.match(/(20\s*L|P\s*13|P\s*20|P\s*45)/i);
      if (unitMatch) {
        const pattern = unitMatch[1].trim();
        if (/20\s*L/i.test(pattern)) {
          // Explicitly water
          const { data: fb } = await supabase.from("produtos").select("id, nome, preco, categoria")
            .eq("ativo", true).eq("categoria", "agua").limit(1);
          produto = fb?.[0];
        } else {
          const n = pattern.replace(/\D/g, "");
          const { data: fb } = await supabase.from("produtos").select("id, nome, preco, categoria")
            .eq("ativo", true).eq("categoria", "gas").ilike("nome", `%P${n}%`).limit(1);
          produto = fb?.[0];
        }
      }
      // Last resort: bare number fallback (only for gas)
      if (!produto) {
        const bareMatch = prodName.match(/(13|20|45)/);
        if (bareMatch && !isWater) {
          const n = bareMatch[1];
          const { data: fb } = await supabase.from("produtos").select("id, nome, preco, categoria")
            .eq("ativo", true).eq("categoria", "gas").ilike("nome", `%P${n}%`).limit(1);
          produto = fb?.[0];
        }
      }
    }
    if (!produto) { console.error("Product not found:", orderData.produto); return; }

    const qty = parseInt(orderData.quantidade) || 1;
    const discInf = parseFloat(String(orderData.desconto ?? "").replace(",", ".")) || 0;
    const disc = discInf > 0 ? discInf : (fallbackDiscountPerUnit > 0 ? fallbackDiscountPerUnit * qty : 0);

    // ===== FONTE AUTORITATIVA DE PREÇO =====
    // O valor cotado pela BIA é fonte da verdade, mas precisamos parser inteligente
    // para distinguir separador decimal de milhar (BR usa "125,00"; IA às vezes usa "125.00").
    const valorCotado = parseValorBR(orderData.valor);
    const usaCotacao = Number.isFinite(valorCotado) && valorCotado > 0;

    // Sanidade: se o valor cotado for absurdamente maior que o preço de tabela (>10x), descarta
    const precoTabela = produto.preco * qty;
    const valorSane = usaCotacao && precoTabela > 0 && valorCotado > precoTabela * 10 ? false : usaCotacao;

    const total = valorSane
      ? Math.max(0, valorCotado - disc)
      : Math.max(0, produto.preco * qty - disc);

    const precoUnitario = valorSane
      ? Math.max(0, total / qty)
      : produto.preco;

    console.log("[createOrder] preço fonte:", valorSane ? "cotação BIA" : "produtos.preco", {
      valorRaw: orderData.valor, valorCotado, precoTabela, qty, disc, total, precoUnitario,
      descartouCotacao: usaCotacao && !valorSane,
    });

    const payMap: Record<string, string> = {
      dinheiro: "dinheiro", pix: "pix", "cartão": "cartao", cartao: "cartao",
      "crédito": "cartao", credito: "cartao", "débito": "cartao", debito: "cartao",
      "vale gás": "vale_gas", valegas: "vale_gas", "vale-gás": "vale_gas",
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
      pedido_id: ped.id, produto_id: produto.id, quantidade: qty, preco_unitario: precoUnitario,
    });

    // Auto-assign entregador based on proximity or route
    if (!isAgendado) {
      let { data: cliente } = await supabase.from("clientes").select("latitude, longitude").eq("id", clienteId).maybeSingle();
      
      // If no coordinates, try to geocode the order address
      let currentLat = cliente?.latitude;
      let currentLng = cliente?.longitude;

      if (!currentLat && orderData.endereco) {
        const coords = await geocodeAddress(orderData.endereco);
        if (coords) {
          currentLat = coords.lat;
          currentLng = coords.lng;
          // Update client with new coordinates for future use
          await supabase.from("clientes").update({ latitude: currentLat, longitude: currentLng }).eq("id", clienteId);
        }
      }

      await autoAssignEntregador(supabase, ped.id, orderData.endereco || "", unidadeId, currentLat, currentLng);
    }

    console.log("Order created:", ped.id);
    return { pedidoId: ped.id as string, entregadorId: (ped as any).entregador_id as string | null };
  } catch (e) {
    console.error("Create order error:", e);
    return null;
  }
}

// ========== AUTO-ASSIGN ENTREGADOR ==========
export async function autoAssignEntregador(
  supabase: any, 
  pedidoId: string, 
  endereco: string, 
  unidadeId: string | null,
  clienteLat?: number | null,
  clienteLng?: number | null
) {
  try {
    let entregadorId: string | null = null;

    // 1. Proximity-based assignment (if coordinates available)
    if (clienteLat && clienteLng && unidadeId) {
      const { data: availableEntregadores } = await supabase.from("entregadores")
        .select("id, latitude, longitude")
        .eq("unidade_id", unidadeId)
        .eq("ativo", true)
        .eq("status", "disponivel")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (availableEntregadores?.length) {
        let minDist = Infinity;
        for (const ent of availableEntregadores) {
          const dist = calculateDistance(clienteLat, clienteLng, ent.latitude, ent.longitude);
          if (dist < minDist) {
            minDist = dist;
            entregadorId = ent.id;
          }
        }
      }
    }

    // 2. Route-based fallback
    if (!entregadorId) {
      const words = endereco.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
      if (words.length > 0 && unidadeId) {
        const { data: rotas } = await supabase.from("rotas_definidas")
          .select("id, entregador_padrao_id, bairros")
          .eq("ativo", true)
          .eq("unidade_id", unidadeId);

        if (rotas) {
          for (const rota of rotas) {
            const bairros = (rota.bairros || []).map((b: string) => b.toLowerCase());
            const matches = words.some((w: string) => bairros.some((b: string) => b.includes(w) || w.includes(b)));
            if (matches && rota.entregador_padrao_id) {
              const { data: ent } = await supabase.from("entregadores").select("id, status")
                .eq("id", rota.entregador_padrao_id).eq("ativo", true).maybeSingle();
              if (ent && ent.status === "disponivel") {
                entregadorId = ent.id;
                break;
              }
            }
          }
        }
      }
    }

    // 3. Fallback: first available
    if (!entregadorId) {
      let q = supabase.from("entregadores").select("id")
        .eq("ativo", true).eq("status", "disponivel").limit(1);
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data: avail } = await q;
      if (avail?.[0]) entregadorId = avail[0].id;
    }

    if (entregadorId) {
      await supabase.from("pedidos").update({ entregador_id: entregadorId }).eq("id", pedidoId);
      console.log("Auto-assigned entregador:", entregadorId, "to order:", pedidoId);
    }
  } catch (e) {
    console.error("Auto-assign error:", e);
  }
}

// ========== GEOLOCATION UTILS ==========
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.trim().length < 5) return null;
  try {
    const query = encodeURIComponent(address.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=br&limit=1`,
      { headers: { "User-Agent": "GasFacilPro-BiaIA" } }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ========== GET ENTREGADOR LOCATION ==========
export async function getEntregadorLocation(supabase: any, clienteId: string | null) {
  if (!clienteId) return null;

  // Find active order with entregador em_rota
  const { data: pedido } = await supabase.from("pedidos")
    .select("id, entregador_id, entregadores:entregador_id(nome, latitude, longitude)")
    .eq("cliente_id", clienteId)
    .eq("status", "saiu_entrega")
    .order("created_at", { ascending: false }).limit(1);

  if (!pedido?.[0]?.entregadores?.latitude) return null;

  const ent = pedido[0].entregadores;
  return {
    nome: ent.nome,
    lat: ent.latitude,
    lng: ent.longitude,
  };
}

// ========== SEND TYPING INDICATOR ==========
export async function sendTyping(config: BiaConfig, phone: string) {
  try {
    if (config.provedor === "meta" || config.provedor === "gateway") {
      // Meta and Gateway don't have native typing indicators, skip
      return;
    } else if (config.provedor === "evolution") {
      // Evolution API v2 - send presence update
      const baseUrl = config.evolutionBaseUrl;
      const instance = config.evolutionInstanceName;
      if (!baseUrl || !instance) return;
      const cleanPhone = phone.replace(/\D/g, "");
      await fetch(`${baseUrl}/chat/presence/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": config.token },
        body: JSON.stringify({ number: `${cleanPhone}@s.whatsapp.net`, presence: "composing" }),
      });
    } else if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/typing`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone }) });
    } else {
      await fetch(`https://free.uazapi.com/chat/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": config.token },
        body: JSON.stringify({ number: phone.replace(/\D/g, ""), presence: "composing" }),
      });
    }
  } catch (e) { console.error("Typing indicator error:", e); }
}

// ========== RATE LIMIT CHECK ==========
export async function checkRateLimit(supabase: any, conversationId: string, maxMessages = 10, windowHours = 2): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("ai_mensagens").select("id", { count: "exact", head: true })
      .eq("conversa_id", conversationId).eq("role", "assistant")
      .gte("created_at", since);
    if (count !== null && count >= maxMessages) {
      console.warn(`Rate limit reached: ${count} msgs in ${windowHours}h for conversation ${conversationId}`);
      return true; // rate limited
    }
    return false;
  } catch (e) { console.error("Rate limit check error:", e); return false; }
}

// ========== SEND MESSAGE ==========
export async function sendMessage(config: BiaConfig, phone: string, message: string): Promise<{ waMessageId?: string; ok: boolean; error?: string }> {
  try {
    if (config.provedor === "evolution") {
      const baseUrl = config.evolutionBaseUrl;
      const instance = config.evolutionInstanceName;
      if (!baseUrl || !instance) { console.error("Evolution: missing baseUrl or instance"); return { ok: false, error: "missing_instance" }; }
      const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");
      const url = `${baseUrl}/message/sendText/${instance}`;
      console.log("Evolution sendMessage:", JSON.stringify({ url, phone: cleanPhone, textLen: message.length }));
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": config.token },
        body: JSON.stringify({ number: `${cleanPhone}@s.whatsapp.net`, text: message }),
      });
      const respText = await resp.text();
      console.log("Evolution sendMessage response:", resp.status, respText.substring(0, 300));
      if ((resp.status === 400 || resp.status === 403) && (respText.includes("Connection Closed") || respText.includes("not connected"))) {
        console.error(`⚠️ Evolution instance ${instance} disconnected — auto-deactivating`);
        try {
          const sb = createSupabase();
          await sb.from("integracoes_whatsapp").update({ ativo: false }).eq("instance_id", instance).eq("provedor", "evolution");
        } catch (dbErr) { console.error("Failed to auto-deactivate:", dbErr); }
        return { ok: false, error: "evolution_disconnected" };
      }
      if (!resp.ok) return { ok: false, error: `evolution_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.key?.id || j?.messageId }; } catch { return { ok: true }; }
    } else if (config.provedor === "gateway") {
      const url = `${config.gatewayBaseUrl}/instances/${config.gatewayInstanceName}/send-text`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
      });
      const respText = await resp.text();
      console.log("Gateway sendMessage response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) return { ok: false, error: `gateway_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.messageId || j?.id }; } catch { return { ok: true }; }
    } else if (config.provedor === "meta") {
      const phoneNumberId = config.metaPhoneNumberId || config.instanceId;
      const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      });
      const respText = await resp.text();
      console.log("Meta sendMessage response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) {
        try { const j = JSON.parse(respText); return { ok: false, error: j?.error?.message || `meta_${resp.status}` }; } catch { return { ok: false, error: `meta_${resp.status}` }; }
      }
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.messages?.[0]?.id }; } catch { return { ok: true }; }
    } else if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-text`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
      const respText = await resp.text();
      if (!resp.ok) return { ok: false, error: `zapi_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.zaapId || j?.messageId || j?.id }; } catch { return { ok: true }; }
    } else {
      const uazUrl = `https://free.uazapi.com/send/text`;
      const uazBody = { number: phone.replace(/\D/g, ""), text: message };
      console.log("UaZapi sendMessage:", JSON.stringify({ url: uazUrl, number: uazBody.number, textLen: message.length }));
      const resp = await fetch(uazUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": config.token },
        body: JSON.stringify(uazBody),
      });
      const respText = await resp.text();
      console.log("UaZapi sendMessage response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) return { ok: false, error: `uazapi_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.id || j?.messageId }; } catch { return { ok: true }; }
    }
  } catch (e) { console.error("Send message error:", e); return { ok: false, error: (e as Error).message }; }
}

// ========== SEND LOCATION (WHATSAPP) ==========
export async function sendLocation(config: BiaConfig, phone: string, lat: number, lng: number, name: string) {
  try {
    if (config.provedor === "evolution") {
      const baseUrl = config.evolutionBaseUrl;
      const instance = config.evolutionInstanceName;
      if (!baseUrl || !instance) return;
      const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");
      await fetch(`${baseUrl}/message/sendLocation/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": config.token },
        body: JSON.stringify({
          number: `${cleanPhone}@s.whatsapp.net`,
          name: `📍 ${name}`,
          address: "Entregador a caminho",
          latitude: lat,
          longitude: lng,
        }),
      });
    } else if (config.provedor === "gateway") {
      const url = `${config.gatewayBaseUrl}/instances/${config.gatewayInstanceName}/send-location`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), latitude: lat, longitude: lng, name: `📍 ${name}`, address: "Entregador a caminho" }),
      });
    } else if (config.provedor === "meta") {
      const phoneNumberId = config.metaPhoneNumberId || config.instanceId;
      const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");
      await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "location",
          location: { longitude: lng, latitude: lat, name: `📍 ${name}`, address: "Entregador a caminho" },
        }),
      });
    } else if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-location`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, lat: String(lat), lng: String(lng), title: `📍 ${name}`, address: "Entregador a caminho" }) });
    } else {
      await fetch(`https://free.uazapi.com/send/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": config.token },
        body: JSON.stringify({ number: phone.replace(/\D/g, ""), lat, lng, name: `📍 ${name}`, address: "Entregador a caminho" }),
      });
    }
  } catch (e) { console.error("Send location error:", e); }
}

// ========== SEND MEDIA (WHATSAPP) ==========
export interface SendMediaInput {
  /** Public/signed URL of the media. */
  mediaUrl: string;
  /** image | audio | video | document */
  mediaType: "image" | "audio" | "video" | "document";
  /** Optional caption for image/video/document. */
  caption?: string;
  /** Filename for document. */
  filename?: string;
  /** MIME type (used by some providers). */
  mimeType?: string;
}

export async function sendMedia(config: BiaConfig, phone: string, input: SendMediaInput): Promise<{ waMessageId?: string; ok: boolean; error?: string }> {
  const { mediaUrl, mediaType, caption, filename, mimeType } = input;
  try {
    const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");

    if (config.provedor === "evolution") {
      const baseUrl = config.evolutionBaseUrl;
      const instance = config.evolutionInstanceName;
      if (!baseUrl || !instance) { console.error("Evolution: missing baseUrl or instance"); return { ok: false, error: "missing_instance" }; }
      let url: string;
      let body: any;
      if (mediaType === "audio") {
        url = `${baseUrl}/message/sendWhatsAppAudio/${instance}`;
        body = { number: `${cleanPhone}@s.whatsapp.net`, audio: mediaUrl };
      } else {
        url = `${baseUrl}/message/sendMedia/${instance}`;
        body = { number: `${cleanPhone}@s.whatsapp.net`, mediatype: mediaType, mimetype: mimeType, media: mediaUrl, caption: caption || "", fileName: filename || "arquivo" };
      }
      const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "apikey": config.token }, body: JSON.stringify(body) });
      const respText = await resp.text();
      console.log("Evolution sendMedia response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) return { ok: false, error: `evolution_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.key?.id || j?.messageId }; } catch { return { ok: true }; }
    } else if (config.provedor === "meta") {
      const phoneNumberId = config.metaPhoneNumberId || config.instanceId;
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
      const mediaPayload: any = { link: mediaUrl };
      if (mediaType === "document") {
        if (filename) mediaPayload.filename = filename;
        if (caption) mediaPayload.caption = caption;
      } else if (mediaType === "image" || mediaType === "video") {
        if (caption) mediaPayload.caption = caption;
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.token}` },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: cleanPhone, type: mediaType, [mediaType]: mediaPayload }),
      });
      const respText = await resp.text();
      console.log("Meta sendMedia response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) {
        try { const j = JSON.parse(respText); return { ok: false, error: j?.error?.message || `meta_${resp.status}` }; } catch { return { ok: false, error: `meta_${resp.status}` }; }
      }
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.messages?.[0]?.id }; } catch { return { ok: true }; }
    } else if (config.provedor === "zapi") {
      const endpointMap: Record<string, string> = { image: "send-image", audio: "send-audio", video: "send-video", document: "send-document" };
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/${endpointMap[mediaType]}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      const body: any = { phone: cleanPhone };
      if (mediaType === "image") { body.image = mediaUrl; if (caption) body.caption = caption; }
      else if (mediaType === "audio") { body.audio = mediaUrl; }
      else if (mediaType === "video") { body.video = mediaUrl; if (caption) body.caption = caption; }
      else if (mediaType === "document") { body.document = mediaUrl; body.fileName = filename || "arquivo"; }
      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const respText = await resp.text();
      console.log("Z-API sendMedia response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) return { ok: false, error: `zapi_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.zaapId || j?.messageId || j?.id }; } catch { return { ok: true }; }
    } else if (config.provedor === "gateway") {
      const url = `${config.gatewayBaseUrl}/instances/${config.gatewayInstanceName}/send-media`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ phone: cleanPhone, mediaUrl, mediaType, caption, filename, mimeType }),
      });
      const respText = await resp.text();
      console.log("Gateway sendMedia response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) return { ok: false, error: `gateway_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.messageId || j?.id }; } catch { return { ok: true }; }
    } else {
      const endpointMap: Record<string, string> = { image: "send/media", audio: "send/media", video: "send/media", document: "send/media" };
      const url = `https://free.uazapi.com/${endpointMap[mediaType]}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": config.token },
        body: JSON.stringify({ number: cleanPhone, type: mediaType, file: mediaUrl, caption: caption || "", docName: filename }),
      });
      const respText = await resp.text();
      console.log("UaZapi sendMedia response:", resp.status, respText.substring(0, 300));
      if (!resp.ok) return { ok: false, error: `uazapi_${resp.status}` };
      try { const j = JSON.parse(respText); return { ok: true, waMessageId: j?.id || j?.messageId }; } catch { return { ok: true }; }
    }
  } catch (e) { console.error("sendMedia error:", e); return { ok: false, error: (e as Error).message }; }
}

// ========== FETCH PROFILE PICTURE ==========
/**
 * Returns a profile picture URL for the given phone number from the WhatsApp provider.
 * Returns null if not available (Meta does not expose end-user profile pictures).
 */
export async function fetchContactProfilePicture(config: BiaConfig, phone: string): Promise<string | null> {
  try {
    const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");

    if (config.provedor === "evolution") {
      const baseUrl = config.evolutionBaseUrl;
      const instance = config.evolutionInstanceName;
      if (!baseUrl || !instance) return null;
      const resp = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": config.token },
        body: JSON.stringify({ number: `${cleanPhone}@s.whatsapp.net` }),
      });
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => null);
      return data?.profilePictureUrl || data?.url || null;

    } else if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/profile-picture?phone=${cleanPhone}`;
      const headers: Record<string, string> = {};
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      const resp = await fetch(url, { headers });
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => null);
      return data?.link || data?.url || null;
    }
    // Meta + uazapi + gateway: not implemented / not supported
    return null;
  } catch (e) {
    console.error("fetchContactProfilePicture error:", e);
    return null;
  }
}

/**
 * Returns the WhatsApp Business profile picture URL for the store itself.
 */
export async function fetchStoreProfilePicture(config: BiaConfig): Promise<string | null> {
  try {
    if (config.provedor === "meta") {
      const phoneNumberId = config.metaPhoneNumberId || config.instanceId;
      const resp = await fetch(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`,
        { headers: { "Authorization": `Bearer ${config.token}` } }
      );
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => null);
      return data?.data?.[0]?.profile_picture_url || null;

    } else if (config.provedor === "evolution") {
      // Evolution does not have a direct endpoint; reuse fetchProfilePictureUrl with own number when known
      return null;
    }
    return null;
  } catch (e) {
    console.error("fetchStoreProfilePicture error:", e);
    return null;
  }
}

// ========== REGISTER CALL ==========
export async function registerCall(
  supabase: any,
  phone: string,
  clienteId: string | null,
  clienteNome: string | null,
  senderName: string,
  unidadeId: string | null,
  pedidoId?: string | null
) {
  await supabase.from("chamadas_recebidas").insert({
    telefone: phone,
    cliente_id: clienteId,
    cliente_nome: clienteNome || senderName,
    tipo: "whatsapp",
    status: "recebida",
    unidade_id: unidadeId,
    pedido_gerado_id: pedidoId || null,
  });
}

