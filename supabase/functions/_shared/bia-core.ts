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
  provedor: "zapi" | "uazapi" | "meta" | "gateway" | "evolution";
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
  provedor: "zapi" | "uazapi" | "meta" | "gateway" | "evolution",
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

  const strategies = [];

  if (queryUnidadeId) {
    strategies.push(
      supabase.from("integracoes_whatsapp").select("*")
        .eq("unidade_id", queryUnidadeId).eq("provedor", provedor).eq("ativo", true).maybeSingle()
    );
  }
  if (payloadInstanceId) {
    // For Meta, search by meta_phone_number_id; for others, by instance_id
    if (provedor === "meta") {
      strategies.push(
        supabase.from("integracoes_whatsapp").select("*")
          .eq("meta_phone_number_id", payloadInstanceId).eq("ativo", true).maybeSingle()
      );
    } else {
      strategies.push(
        supabase.from("integracoes_whatsapp").select("*")
          .eq("instance_id", payloadInstanceId).eq("ativo", true).maybeSingle()
      );
    }
  }
  strategies.push(
    supabase.from("integracoes_whatsapp").select("*")
      .eq("provedor", provedor).eq("ativo", true).limit(2)
  );

  for (const strategy of strategies) {
    const { data } = await strategy;
    const config = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    if (config?.token && (config?.instance_id || provedor === "meta")) {
      return {
        instanceId: config.instance_id || config.meta_phone_number_id || "",
        token: config.token,
        securityToken: config.security_token || null,
        unidadeId: config.unidade_id,
        descontoEtapa1: config.desconto_etapa1 ?? 5,
        descontoEtapa2: config.desconto_etapa2 ?? 10,
        precoMinimoP13: config.preco_minimo_p13 ?? null,
        precoMinimoP20: config.preco_minimo_p20 ?? null,
        provedor,
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

  // Strategy 1: Find by instance name/id in integracoes_whatsapp
  if (instanceNameOrId) {
    const { data: byInstance } = await supabase.from("integracoes_whatsapp").select("*")
      .eq("instance_id", instanceNameOrId).eq("provedor", "evolution").eq("ativo", true).maybeSingle();
    config = byInstance;
  }

  // Strategy 2: Find by unidade_id
  if (!config && queryUnidadeId) {
    const { data } = await supabase.from("integracoes_whatsapp").select("*")
      .eq("unidade_id", queryUnidadeId).eq("provedor", "evolution").eq("ativo", true).maybeSingle();
    config = data;
  }

  // Strategy 3: Find any active evolution config (single instance fallback)
  if (!config) {
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
    .select("horario_abertura, horario_fechamento, empresa_id").eq("id", unidadeId).maybeSingle();

  if (!u?.empresa_id) return { isOffHours: false, horarioInfo: "", isSunday: false, waterDeliveryAllowed: true, empresaId: u?.empresa_id || null };

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
      return { isOffHours: true, horarioInfo: "Não abrimos aos domingos", isSunday: true, waterDeliveryAllowed: false, empresaId: u.empresa_id };
    }
    // Respect dynamic Sunday closing time from regras_bia
    effectiveClosing = fechamentoDomingo;
  }

  return {
    isOffHours: cur < abertura || cur >= effectiveClosing,
    horarioInfo: `das ${abertura} às ${effectiveClosing}${isSunday ? " (horário especial de domingo)" : ""}`,
    isSunday,
    waterDeliveryAllowed: !(isSunday && !aguaEntregaDomingo),
    empresaId: u.empresa_id || null,
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

  // Scan user messages for payment method and institutional detection
  const userMsgs = history.filter((m: any) => m.role === "user");
  for (const msg of userMsgs) {
    const t = msg.content.toLowerCase();

    // Detect institutional client
    if (!result.clienteInstitucional && /\b(escola|col[eé]gio|pol[ií]cia|secretaria\s*(de\s*educa[çc][aã]o)?|assist[eê]ncia\s*social|prefeitura)\b/i.test(t)) {
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

  // Check if address was confirmed (assistant asked "Entrego na..." and user said sim/ok)
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].role === "assistant" && /entrego\s*(na|no|em)\s/i.test(history[i].content)) {
      const next = history[i + 1];
      if (next?.role === "user" && /^(sim|ok|isso|pode|confirmo|confirmed|s|ss|sss|é|eh|correto|certo|beleza|blz)/i.test(next.content.trim())) {
        result.enderecoConfirmado = true;
      }
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
  history?: any[]
): string {
  const agentName = config.agentName || "Bia";
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

  return `Você é a ${agentName}, assistente virtual de vendas de gás da empresa. Seu atendimento deve ser humano, educado e objetivo.

ANTI-REPETIÇÃO (CRÍTICO — SIGA À RISCA):
- Se o histórico já contém sua saudação (Olá, Bom dia, etc.), NÃO cumprimente novamente. Vá direto ao assunto.
- Se o cliente já disse o que quer (gás, água, etc.), NÃO pergunte "como posso ajudar". Avance para confirmar endereço.
- NUNCA repita a mesma mensagem ou pergunta duas vezes consecutivas.
- Leia o histórico completo antes de responder — se já perguntou algo, NÃO repita.
- Se o cliente informou forma de pagamento, NÃO pergunte novamente.

ETAPA ATUAL DA CONVERSA: ${currentStep.label}. NÃO volte a passos anteriores.${collectedSection}${finalizeHint}

REGRAS DE OURO:
1. NÃO FINALIZAR PEDIDOS AUTOMATICAMENTE: Mesmo que o cliente já seja conhecido, NUNCA crie ou confirme um pedido no início da conversa.
2. ESPERAR O PEDIDO: Comece apenas saudando pelo nome. Espere o cliente dizer que quer gás ou água antes de seguir para o endereço.
3. PREÇO RÍGIDO: O valor a ser registrado no sistema deve ser EXATAMENTE o valor que você informou ao cliente na conversa.

FLUXO OBRIGATÓRIO (NÃO PULE ETAPAS):
Passo 1 – SAUDAÇÃO: "Olá [Nome]! 👋 Que bom falar com você. Como posso ajudar hoje?" (SÓ na primeira mensagem, NUNCA repetir)
Passo 2 – CLIENTE PEDE PRODUTO: Só após o cliente pedir, você confirma o endereço.
Passo 3 – CONFIRMAR ENDEREÇO: "A entrega será na [Endereço]?" (Aguarde o "Sim" ou novo endereço).
Passo 4 – FORMA DE PAGAMENTO: "Qual será a forma de pagamento (Dinheiro, Pix ou Cartão)?"
Passo 5 – REGISTRAR: Após as confirmações, informe: "Perfeito! Seu pedido foi registrado. Entrega prevista: 20 a 40 minutos."

IDENTIFICAÇÃO DE ENDEREÇO: Considere informado se a mensagem tiver Rua/Av/Travessa + número ou pontos de referência claros.

PRODUTOS E PREÇOS DISPONÍVEIS:
${productList}

DADOS TÉCNICOS (SÓ GERE APÓS O PASSO 5):
[PEDIDO_CONFIRMADO]
nome: ${cliente.nome || "Cliente"}
produto: (Nome EXATO: "Gás P13", "Gás P20", "Gás P45" ou "Água Mineral 20L")
quantidade: 1
endereco: Endereço completo
pagamento: forma escolhida
valor: (O valor EXATO que você informou ao cliente)
telefone: ${normalized}
[/PEDIDO_CONFIRMADO]

${isOffHours ? `FORA DO HORÁRIO (${horarioInfo}): Informe fechamento e ofereça agendamento.` : ""}
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

  const trimmed = messageText.trim();
  
  // Only treat as follow-up if the ENTIRE message is a short acknowledgment (max 3 words)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 3) return false;

  const isNewOrder = /(quero|preciso|novo pedido|pedido|gás|gas|botij|p13|p20|p45|água|agua|comprar|entrega|preço|preco|quanto)/i.test(trimmed);
  const isFollowUp = /^(obrigad[oa]?|valeu|certo|perfeito|show|blz|beleza|tmj|falou|vlw|brigad[oa]?|thanks|thx)$/i.test(trimmed);

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
    const total = Math.max(0, produto.preco * qty - disc);

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
      pedido_id: ped.id, produto_id: produto.id, quantidade: qty, preco_unitario: produto.preco,
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

// ========== SEND MESSAGE ==========
export async function sendMessage(config: BiaConfig, phone: string, message: string) {
  try {
    if (config.provedor === "evolution") {
      // Evolution API v2 - send text message
      const baseUrl = config.evolutionBaseUrl;
      const instance = config.evolutionInstanceName;
      if (!baseUrl || !instance) { console.error("Evolution: missing baseUrl or instance"); return; }
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
    } else if (config.provedor === "gateway") {
      // Send via WhatsApp Gateway API
      const url = `${config.gatewayBaseUrl}/instances/${config.gatewayInstanceName}/send-text`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
      });
      const respText = await resp.text();
      console.log("Gateway sendMessage response:", resp.status, respText.substring(0, 300));
    } else if (config.provedor === "meta") {
      // Meta WhatsApp Cloud API
      const phoneNumberId = config.metaPhoneNumberId || config.instanceId;
      const cleanPhone = phone.replace(/\D/g, "").replace(/@.*/, "");
      const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.token}`,
        },
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
    } else if (config.provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-text`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.securityToken) headers["Client-Token"] = config.securityToken;
      await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
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
    }
  } catch (e) { console.error("Send message error:", e); }
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
      await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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

