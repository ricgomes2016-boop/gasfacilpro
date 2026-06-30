// bia-entregador.ts — Lançamento de pedidos por entregador via WhatsApp da loja.
// Reaproveita callAI, normalizePhone, geocodeAddress de bia-core. Apenas dispara
// quando o telefone do remetente coincide com um entregador ATIVO da unidade
// associada à instância de WhatsApp.

import { callAI, normalizePhone, geocodeAddress } from "./bia-core.ts";

export interface EntregadorMatch {
  id: string;
  nome: string;
  unidade_id: string | null;
  empresa_id: string | null;
}

export interface DraftItem {
  quantidade: number;
  produto: string;
  cliente_texto: string | null;
  endereco_texto: string | null;
  valor: number;
  forma_pagamento: string;
}

const CONFIRM_REGEX = /^\s*(ok|okay|sim|confirmo|confirmar|pode lan(c|ç)ar|fechar|fechado|isso|isso mesmo|valeu)\s*[!.]?\s*$/i;
const CANCEL_REGEX = /^\s*(n(ã|a)o|nao|cancela|cancelar|esquece|errado|nada disso)\s*[!.]?\s*$/i;

export function isConfirmation(text: string) {
  return CONFIRM_REGEX.test(text.trim());
}
export function isCancellation(text: string) {
  return CANCEL_REGEX.test(text.trim());
}

/** Busca entregador ativo cujo telefone bate com o remetente. */
export async function findEntregadorByPhone(
  supabase: any,
  phone: string,
  unidadeId: string | null,
): Promise<EntregadorMatch | null> {
  const norm = normalizePhone(phone);
  const last10 = norm.slice(-10);
  const last11 = norm.slice(-11);
  const patterns = Array.from(new Set([norm, last11, last10])).filter(Boolean);

  let query = supabase
    .from("entregadores")
    .select("id, nome, unidade_id, ativo")
    .eq("ativo", true);

  if (unidadeId) query = query.eq("unidade_id", unidadeId);

  const orFilter = patterns.map((p) => `telefone.ilike.%${p}%`).join(",");
  const { data, error } = await query.or(orFilter).limit(1);
  if (error || !data || data.length === 0) return null;

  const ent = data[0];
  let empresaId: string | null = null;
  if (ent.unidade_id) {
    const { data: u } = await supabase.from("unidades").select("empresa_id").eq("id", ent.unidade_id).maybeSingle();
    empresaId = u?.empresa_id || null;
  }
  return { id: ent.id, nome: ent.nome, unidade_id: ent.unidade_id, empresa_id: empresaId };
}

/** Parser via IA: extrai array de itens. Tolerante a múltiplas linhas. */
export async function parseEntregadorMessage(text: string): Promise<DraftItem[]> {
  const prompt = `Você é um parser. Recebe uma mensagem de WhatsApp do ENTREGADOR informando entregas já realizadas, e devolve APENAS JSON válido no formato:
{"pedidos":[{"quantidade":1,"produto":"Gás P13","cliente_texto":null,"endereco_texto":"Rua Ceará 331","valor":100,"forma_pagamento":"pix"}]}

Regras:
- Uma entrega por linha (ou separada por ";" ou "/").
- "gas"/"gás"/"p13"/"botijão" => produto "Gás P13"; "p20" => "Gás P20"; "p45" => "Gás P45"; "agua"/"água"/"20l" => "Água 20L".
- forma_pagamento: pix | dinheiro | cartao | fiado.
- valor: número (R$). Aceita "100", "100,00", "R$ 100".
- quantidade: inteiro, padrão 1.
- Se a entrada cita nome (ex.: "padaria da tia lena"), use cliente_texto; senão null.
- endereco_texto: texto livre do endereço, ou null.
- NÃO invente itens. Se a linha for ambígua, ignore-a.
- Resposta = SOMENTE o JSON, sem texto antes ou depois.

Mensagem:
"""${text}"""`;

  const reply = await callAI([
    { role: "system", content: "Você responde apenas com JSON válido conforme solicitado." },
    { role: "user", content: prompt },
  ]);

  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const items: any[] = parsed.pedidos || [];
    return items
      .map((p) => normalizeItem(p))
      .filter((p): p is DraftItem => p !== null);
  } catch {
    return [];
  }
}

function normalizeItem(raw: any): DraftItem | null {
  if (!raw || typeof raw !== "object") return null;
  const produtoRaw = String(raw.produto || "").toLowerCase();
  let produto = "Gás P13";
  if (/p\s*20/.test(produtoRaw)) produto = "Gás P20";
  else if (/p\s*45/.test(produtoRaw)) produto = "Gás P45";
  else if (/agua|água|20\s*l/.test(produtoRaw)) produto = "Água 20L";

  const valor = Number(String(raw.valor ?? "").toString().replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
  if (valor <= 0) return null;

  const pgRaw = String(raw.forma_pagamento || "").toLowerCase();
  let forma = "dinheiro";
  if (/pix/.test(pgRaw)) forma = "pix";
  else if (/cart/.test(pgRaw) || /cred|deb/.test(pgRaw)) forma = "cartao";
  else if (/fiad|prazo/.test(pgRaw)) forma = "fiado";

  return {
    quantidade: Math.max(1, parseInt(String(raw.quantidade || "1"), 10) || 1),
    produto,
    cliente_texto: raw.cliente_texto ? String(raw.cliente_texto).trim() : null,
    endereco_texto: raw.endereco_texto ? String(raw.endereco_texto).trim() : null,
    valor,
    forma_pagamento: forma,
  };
}

const PG_LABEL: Record<string, string> = { pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão", fiado: "Fiado" };

export function formatResumo(items: DraftItem[], entregadorNome: string): string {
  const lines: string[] = [];
  lines.push(`👋 Olá, ${entregadorNome}. Confirma ${items.length} lançamento${items.length > 1 ? "s" : ""}?`);
  items.forEach((it, idx) => {
    const ref = it.cliente_texto || it.endereco_texto || "—";
    const valor = `R$ ${it.valor.toFixed(2).replace(".", ",")}`;
    lines.push(`#${idx + 1} ${ref} · ${it.quantidade}× ${it.produto} · ${valor} · ${PG_LABEL[it.forma_pagamento]}`);
  });
  lines.push("");
  lines.push("Responda *OK* para lançar tudo, ou *não* para cancelar.");
  return lines.join("\n");
}

// ===================== Draft storage =====================

export async function saveDraft(
  supabase: any,
  telefone: string,
  entregador: EntregadorMatch,
  items: DraftItem[],
) {
  // upsert por telefone — sempre substitui o último rascunho
  await supabase.from("entregador_lancamento_drafts").delete().eq("telefone", telefone);
  const { error } = await supabase.from("entregador_lancamento_drafts").insert({
    telefone,
    entregador_id: entregador.id,
    unidade_id: entregador.unidade_id,
    empresa_id: entregador.empresa_id,
    payload: items,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) console.error("[bia-entregador] saveDraft erro:", error);
}

export async function loadDraft(
  supabase: any,
  telefone: string,
): Promise<{ entregador: EntregadorMatch; items: DraftItem[] } | null> {
  const { data } = await supabase
    .from("entregador_lancamento_drafts")
    .select("entregador_id, unidade_id, empresa_id, payload, expires_at")
    .eq("telefone", telefone)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { data: ent } = await supabase.from("entregadores").select("nome").eq("id", data.entregador_id).maybeSingle();
  return {
    entregador: { id: data.entregador_id, nome: ent?.nome || "Entregador", unidade_id: data.unidade_id, empresa_id: data.empresa_id },
    items: (data.payload as DraftItem[]) || [],
  };
}

export async function clearDraft(supabase: any, telefone: string) {
  await supabase.from("entregador_lancamento_drafts").delete().eq("telefone", telefone);
}

// ===================== Resolução de cliente / produto =====================

async function resolveCliente(
  supabase: any,
  item: DraftItem,
  unidadeId: string | null,
  empresaId: string | null,
): Promise<{ clienteId: string | null; clienteNome: string; endereco: string }> {
  const queryText = (item.cliente_texto || item.endereco_texto || "").trim();
  const endereco = item.endereco_texto || "";

  if (queryText && unidadeId) {
    // Match simples: busca por nome ou endereço com ilike, escopado à unidade
    const like = `%${queryText.slice(0, 40)}%`;
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, endereco")
      .or(`nome.ilike.${like},endereco.ilike.${like}`)
      .limit(2);
    if (data && data.length === 1) {
      return { clienteId: data[0].id, clienteNome: data[0].nome, endereco: endereco || data[0].endereco || "" };
    }
  }

  // Cria cliente avulso
  const nome = item.cliente_texto
    ? item.cliente_texto.replace(/\b\w/g, (c) => c.toUpperCase())
    : item.endereco_texto
      ? `Cliente ${item.endereco_texto.split(",")[0]}`
      : "Cliente Avulso";

  const insert: any = { nome, endereco: endereco || null };
  if (empresaId) insert.empresa_id = empresaId;
  const { data: novo, error } = await supabase.from("clientes").insert(insert).select("id, nome").single();
  if (error || !novo) return { clienteId: null, clienteNome: nome, endereco };
  if (unidadeId) await supabase.from("cliente_unidades").insert({ cliente_id: novo.id, unidade_id: unidadeId });
  return { clienteId: novo.id, clienteNome: novo.nome, endereco };
}

async function findProduto(supabase: any, nome: string) {
  const isWater = /água|agua|20\s*l/i.test(nome);
  const isGas = /g[aá]s|p\s*13|p\s*20|p\s*45/i.test(nome);
  const cat = isWater ? "agua" : isGas ? "gas" : null;
  const unitMatch = nome.match(/(20\s*L|P\s*13|P\s*20|P\s*45)/i);
  let q = supabase.from("produtos").select("id, nome, preco").eq("ativo", true);
  if (cat) q = q.eq("categoria", cat);
  if (unitMatch) q = q.ilike("nome", `%${unitMatch[1].replace(/\s+/g, "")}%`);
  const { data } = await q.limit(1);
  return data?.[0] || null;
}

// ===================== Criação dos pedidos =====================

export async function createEntregadorOrders(
  supabase: any,
  draft: { entregador: EntregadorMatch; items: DraftItem[] },
  telefone: string,
): Promise<{ pedidoNumeros: number[]; falhas: number }> {
  const numeros: number[] = [];
  let falhas = 0;

  for (const item of draft.items) {
    try {
      const produto = await findProduto(supabase, item.produto);
      if (!produto) { falhas++; continue; }

      const { clienteId, clienteNome, endereco } = await resolveCliente(
        supabase, item, draft.entregador.unidade_id, draft.entregador.empresa_id,
      );

      const qty = item.quantidade;
      const total = item.valor;
      const precoUnitario = qty > 0 ? total / qty : total;

      const { data: ped, error } = await supabase.from("pedidos").insert({
        cliente_id: clienteId,
        valor_total: total,
        forma_pagamento: item.forma_pagamento,
        status: "em_rota",
        canal_venda: "whatsapp",
        origem_pedido: "whatsapp_entregador",
        endereco_entrega: endereco,
        observacoes: `Lançado pelo entregador via WhatsApp - ${clienteNome} (${telefone})`,
        unidade_id: draft.entregador.unidade_id,
        entregador_id: draft.entregador.id,
      }).select("id, numero_sequencial").single();

      if (error || !ped) { console.error("[bia-entregador] pedido erro:", error); falhas++; continue; }

      await supabase.from("pedido_itens").insert({
        pedido_id: ped.id,
        produto_id: produto.id,
        quantidade: qty,
        preco_unitario: precoUnitario,
      });

      // Geocode oportunista se cliente sem coords
      if (clienteId && endereco) {
        const { data: cli } = await supabase.from("clientes").select("latitude").eq("id", clienteId).maybeSingle();
        if (cli && !cli.latitude) {
          const coords = await geocodeAddress(endereco);
          if (coords) await supabase.from("clientes").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", clienteId);
        }
      }

      numeros.push(ped.numero_sequencial || 0);
    } catch (e) {
      console.error("[bia-entregador] item falhou:", e);
      falhas++;
    }
  }

  return { pedidoNumeros: numeros, falhas };
}

export function formatResultado(numeros: number[], falhas: number): string {
  const lines: string[] = [];
  if (numeros.length > 0) {
    const ids = numeros.filter((n) => n > 0).map((n) => `#${n}`).join(", ");
    lines.push(`✅ ${numeros.length} pedido${numeros.length > 1 ? "s" : ""} lançado${numeros.length > 1 ? "s" : ""} em rota com você${ids ? `: ${ids}` : ""}.`);
  }
  if (falhas > 0) lines.push(`⚠️ ${falhas} linha${falhas > 1 ? "s" : ""} não pude lançar — confira e reenvie.`);
  if (lines.length === 0) lines.push("Não consegui lançar nenhum pedido. Reenvie no formato: `1 gas, rua X 123, 100 pix`.");
  return lines.join("\n");
}

// ===================== Handler principal =====================

/**
 * Tenta processar a mensagem como lançamento de entregador.
 * @returns reply string se for entregador (cabe ao webhook enviar), ou null se não for entregador (segue fluxo cliente).
 */
export async function handleEntregadorMessage(
  supabase: any,
  phone: string,
  messageText: string,
  unidadeId: string | null,
): Promise<string | null> {
  const entregador = await findEntregadorByPhone(supabase, phone, unidadeId);
  if (!entregador) return null;

  const normalized = normalizePhone(phone);
  const text = messageText.trim();

  // 1) Confirmação de rascunho pendente
  if (isConfirmation(text)) {
    const draft = await loadDraft(supabase, normalized);
    if (!draft || draft.items.length === 0) {
      return `Olá, ${entregador.nome}! Não há lançamentos pendentes. Mande no formato: \`1 gas, rua X 123, 100 pix\`.`;
    }
    const result = await createEntregadorOrders(supabase, draft, normalized);
    await clearDraft(supabase, normalized);
    return formatResultado(result.pedidoNumeros, result.falhas);
  }

  // 2) Cancelamento de rascunho
  if (isCancellation(text)) {
    const draft = await loadDraft(supabase, normalized);
    if (!draft) return `Sem lançamentos pendentes, ${entregador.nome}.`;
    await clearDraft(supabase, normalized);
    return `❌ Lançamento cancelado. Mande novamente quando quiser.`;
  }

  // 3) Nova proposta — parse + resumo
  const items = await parseEntregadorMessage(text);
  if (items.length === 0) {
    return `Olá, ${entregador.nome}! Não entendi. Use o formato:\n\`1 gas, rua Ceará 331, 100 pix\`\npode mandar vários, um por linha.`;
  }

  await saveDraft(supabase, normalized, entregador, items);
  return formatResumo(items, entregador.nome);
}
