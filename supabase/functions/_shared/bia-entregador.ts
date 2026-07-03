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

/**
 * Gera variantes de telefone tolerantes ao formato brasileiro:
 * - normalizado completo, últimos 11, últimos 10, últimos 8 dígitos
 * - versão "com 9" inserido depois do DDD (celular)
 * - versão "sem 9" depois do DDD (fixo antigo ou entrada sem o 9)
 * Todas usadas em ilike contra a coluna telefone.
 */
function buildPhoneVariants(phone: string): string[] {
  const norm = normalizePhone(phone) || "";
  const digits = norm.replace(/\D/g, "");
  const variants = new Set<string>();

  if (digits) variants.add(digits);
  if (digits.length >= 8) variants.add(digits.slice(-8));
  if (digits.length >= 10) variants.add(digits.slice(-10));
  if (digits.length >= 11) variants.add(digits.slice(-11));

  // Considera bloco DDD+número (últimos 10 ou 11)
  const base = digits.slice(-11).length >= 10 ? digits.slice(-11) : digits;
  if (base.length >= 10) {
    const ddd = base.slice(0, 2);
    const resto = base.slice(2);
    // resto pode ter 8 (sem 9) ou 9 (com 9) dígitos
    if (resto.length === 8) {
      variants.add(ddd + resto);           // sem 9
      variants.add(ddd + "9" + resto);     // com 9
      variants.add("9" + resto);           // celular sem DDD
      variants.add(resto);                 // 8 dígitos puros
    } else if (resto.length === 9) {
      variants.add(ddd + resto);           // com 9
      const sem9 = resto.startsWith("9") ? resto.slice(1) : resto;
      variants.add(ddd + sem9);            // sem 9
      variants.add(sem9);
      variants.add(resto);
    }
  }

  return Array.from(variants).filter((v) => v && v.length >= 6);
}

/** Busca entregador ativo cujo telefone bate com o remetente. */
export async function findEntregadorByPhone(
  supabase: any,
  phone: string,
  unidadeId: string | null,
): Promise<EntregadorMatch | null> {
  // Ignora identificadores não-numéricos (ex.: LID) sem base de dígitos
  const rawDigits = (phone || "").replace(/\D/g, "");
  if (rawDigits.length < 8) return null;

  const patterns = buildPhoneVariants(phone);
  if (patterns.length === 0) return null;

  // Resolve empresa_id a partir da unidade da instância (quando houver)
  let empresaId: string | null = null;
  if (unidadeId) {
    const { data: u } = await supabase
      .from("unidades").select("empresa_id").eq("id", unidadeId).maybeSingle();
    empresaId = u?.empresa_id || null;
  }

  // Coleta unidades da empresa para ampliar a busca (entregador pode estar
  // cadastrado em unidade irmã da mesma empresa).
  let unidadeIds: string[] = [];
  if (empresaId) {
    const { data: irmas } = await supabase
      .from("unidades").select("id").eq("empresa_id", empresaId);
    unidadeIds = (irmas || []).map((r: any) => r.id);
  } else if (unidadeId) {
    unidadeIds = [unidadeId];
  }

  const orFilter = patterns.map((p) => `telefone.ilike.%${p}%`).join(",");
  let query = supabase
    .from("entregadores")
    .select("id, nome, unidade_id, ativo")
    .eq("ativo", true)
    .or(orFilter);

  if (unidadeIds.length > 0) query = query.in("unidade_id", unidadeIds);

  const { data, error } = await query.limit(10);
  if (error || !data || data.length === 0) return null;

  // Prefere match na própria unidade da instância
  const preferido = unidadeId
    ? data.find((e: any) => e.unidade_id === unidadeId)
    : null;
  const ent = preferido || data[0];

  let entEmpresaId = empresaId;
  if (!entEmpresaId && ent.unidade_id) {
    const { data: u } = await supabase
      .from("unidades").select("empresa_id").eq("id", ent.unidade_id).maybeSingle();
    entEmpresaId = u?.empresa_id || null;
  }
  return { id: ent.id, nome: ent.nome, unidade_id: ent.unidade_id, empresa_id: entEmpresaId };
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

function normalizeStr(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*(rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|al\.?|pra[cç]a|pc\.?|estrada|estr\.?|rodovia|rod\.?)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEndereco(texto: string): { rua: string; numero: string; bairro: string } {
  const raw = (texto || "").trim();
  if (!raw) return { rua: "", numero: "", bairro: "" };
  // Ex.: "Rua Francisco Bayardo Lacerda, 23, Centro" | "Av. Brasil 123 - Bairro X"
  const parts = raw.split(/[,\-–—]/).map((p) => p.trim()).filter(Boolean);
  let rua = parts[0] || "";
  let numero = "";
  let bairro = "";
  const numMatch = rua.match(/\b(\d{1,6})\b/);
  if (numMatch) {
    numero = numMatch[1];
    rua = rua.replace(numMatch[0], "").trim();
  }
  if (parts.length >= 2) {
    const p2 = parts[1];
    const nm = p2.match(/^\d{1,6}$/);
    if (nm && !numero) numero = nm[0];
    else if (!numero && /^\d{1,6}/.test(p2)) {
      const m = p2.match(/^(\d{1,6})\s*(.*)$/);
      if (m) { numero = m[1]; if (m[2]) bairro = m[2]; }
    } else if (!bairro) bairro = p2;
  }
  if (!bairro && parts.length >= 3) bairro = parts[2];
  return { rua: rua.trim(), numero: numero.trim(), bairro: bairro.trim() };
}

/**
 * Tenta encontrar cliente existente priorizando ENDEREÇO na unidade.
 * Ordem: 1) endereço (clientes + cliente_enderecos), 2) nome, 3) cria novo.
 */
async function resolveCliente(
  supabase: any,
  item: DraftItem,
  unidadeId: string | null,
  empresaId: string | null,
): Promise<{ clienteId: string | null; clienteNome: string; endereco: string }> {
  const endereco = (item.endereco_texto || "").trim();
  const nomeTexto = (item.cliente_texto || "").trim();
  const parsed = parseEndereco(endereco);
  const ruaNorm = normalizeStr(parsed.rua);
  const bairroNorm = normalizeStr(parsed.bairro);

  // IDs de clientes escopo unidade
  let clienteIdsUnidade: string[] = [];
  if (unidadeId) {
    const { data: cu } = await supabase
      .from("cliente_unidades")
      .select("cliente_id")
      .eq("unidade_id", unidadeId);
    clienteIdsUnidade = (cu || []).map((r: any) => r.cliente_id);
  }

  // 1) Match por ENDEREÇO
  if (ruaNorm && ruaNorm.length >= 3 && clienteIdsUnidade.length > 0) {
    const ruaLike = `%${parsed.rua.slice(0, 30)}%`;
    // 1a) tabela clientes
    const { data: matches } = await supabase
      .from("clientes")
      .select("id, nome, endereco, numero, bairro")
      .in("id", clienteIdsUnidade)
      .ilike("endereco", ruaLike)
      .limit(20);

    const scored = (matches || []).map((c: any) => {
      const cRua = normalizeStr(c.endereco || "");
      const cBairro = normalizeStr(c.bairro || "");
      let score = 0;
      if (cRua && (cRua.includes(ruaNorm) || ruaNorm.includes(cRua))) score += 3;
      if (parsed.numero && String(c.numero || "").trim() === parsed.numero) score += 3;
      if (bairroNorm && cBairro && (cBairro === bairroNorm || cBairro.includes(bairroNorm))) score += 2;
      return { c, score };
    }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const best = scored[0].c;
      console.log("[bia-entregador] cliente resolvido por endereço:", best.id, best.nome);
      return { clienteId: best.id, clienteNome: best.nome, endereco: endereco || best.endereco || "" };
    }

    // 1b) tabela cliente_enderecos (endereços adicionais do app)
    const { data: ce } = await supabase
      .from("cliente_enderecos")
      .select("cliente_id, rua, numero, bairro")
      .in("cliente_id", clienteIdsUnidade)
      .ilike("rua", ruaLike)
      .limit(20);
    const scoredCe = (ce || []).map((r: any) => {
      const cRua = normalizeStr(r.rua || "");
      const cBairro = normalizeStr(r.bairro || "");
      let score = 0;
      if (cRua && (cRua.includes(ruaNorm) || ruaNorm.includes(cRua))) score += 3;
      if (parsed.numero && String(r.numero || "").trim() === parsed.numero) score += 3;
      if (bairroNorm && cBairro && (cBairro === bairroNorm || cBairro.includes(bairroNorm))) score += 2;
      return { r, score };
    }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score);
    if (scoredCe.length > 0) {
      const cliId = scoredCe[0].r.cliente_id;
      const { data: cli } = await supabase.from("clientes").select("id, nome, endereco").eq("id", cliId).maybeSingle();
      if (cli) {
        console.log("[bia-entregador] cliente resolvido por cliente_enderecos:", cli.id, cli.nome);
        return { clienteId: cli.id, clienteNome: cli.nome, endereco: endereco || cli.endereco || "" };
      }
    }
  }

  // 2) Match por NOME dentro da unidade
  if (nomeTexto && nomeTexto.length >= 3 && clienteIdsUnidade.length > 0) {
    const like = `%${nomeTexto.slice(0, 40)}%`;
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, endereco")
      .in("id", clienteIdsUnidade)
      .ilike("nome", like)
      .limit(2);
    if (data && data.length === 1) {
      console.log("[bia-entregador] cliente resolvido por nome:", data[0].id, data[0].nome);
      return { clienteId: data[0].id, clienteNome: data[0].nome, endereco: endereco || data[0].endereco || "" };
    }
  }

  // 3) Cria cliente novo
  const nome = nomeTexto
    ? nomeTexto.replace(/\b\w/g, (c) => c.toUpperCase())
    : endereco
      ? `Cliente ${endereco.split(",")[0]}`
      : "Cliente Avulso";

  const insert: any = {
    nome,
    endereco: parsed.rua || endereco || null,
    numero: parsed.numero || null,
    bairro: parsed.bairro || null,
  };
  if (empresaId) insert.empresa_id = empresaId;
  const { data: novo, error } = await supabase.from("clientes").insert(insert).select("id, nome").single();
  if (error || !novo) return { clienteId: null, clienteNome: nome, endereco };
  if (unidadeId) await supabase.from("cliente_unidades").insert({ cliente_id: novo.id, unidade_id: unidadeId });
  console.log("[bia-entregador] cliente novo criado:", novo.id, novo.nome);
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
