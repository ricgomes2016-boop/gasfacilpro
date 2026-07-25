// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  unidade_id: z.string().uuid(),
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function classificarProduto(nome: string): string | null {
  const n = (nome || "").toLowerCase();
  if (n.includes("p13") || n.includes("13kg")) return "P13";
  if (n.includes("p20") || n.includes("20kg")) return "P20";
  if (n.includes("p45") || n.includes("45kg")) return "P45";
  if (n.includes("p05") || n.includes("5kg") || n.includes(" p5")) return "P05";
  if (n.includes("água") || n.includes("agua")) return "Água";
  if ((n.includes("galão") || n.includes("galao")) && n.includes("vazio")) return "VAZIO";
  return null;
}

function pesoKg(tipo: string | null): number {
  if (tipo === "P13") return 13;
  if (tipo === "P20") return 20;
  if (tipo === "P45") return 45;
  if (tipo === "P05") return 5;
  return 0;
}

async function montarROMes(supabase: any, unidadeId: string, ano: number, mes: number) {
  const inicio = new Date(ano, mes - 1, 1).toISOString();
  const fim = new Date(ano, mes, 0, 23, 59, 59).toISOString();
  const inicioDate = inicio.substring(0, 10);
  const fimDate = fim.substring(0, 10);

  const [pedidosRes, prodRes, cpRes, mcRes, dcRes, ajRes] = await Promise.all([
    supabase.from("pedidos")
      .select("id, canal_venda, status, pedido_itens(quantidade, preco_unitario, produto_id)")
      .eq("unidade_id", unidadeId)
      .gte("created_at", inicio).lte("created_at", fim)
      .neq("status", "cancelado"),
    supabase.from("produtos").select("id, nome, preco_custo, preco").eq("unidade_id", unidadeId),
    supabase.from("contas_pagar").select("valor, categoria, descricao")
      .eq("unidade_id", unidadeId).eq("status", "pago")
      .gte("vencimento", inicioDate).lte("vencimento", fimDate),
    supabase.from("movimentacoes_caixa").select("valor, categoria, descricao")
      .eq("unidade_id", unidadeId).eq("tipo", "saida").neq("status", "rejeitada")
      .is("compra_id", null).is("pedido_id", null)
      .gte("created_at", inicio).lte("created_at", fim),
    supabase.from("despesas_contabeis").select("valor, categoria, descricao")
      .eq("unidade_id", unidadeId)
      .gte("data_competencia", inicioDate).lte("data_competencia", fimDate),
    supabase.from("ro_ajustes_mensais").select("chave, valor")
      .eq("unidade_id", unidadeId).eq("ano", ano).eq("mes", mes),
  ]);

  const produtos = prodRes.data || [];
  const prodMap = new Map(produtos.map((p: any) => [p.id, p]));
  const ajustes: Record<string, number> = {};
  (ajRes.data || []).forEach((a: any) => { ajustes[a.chave] = Number(a.valor) || 0; });

  // Estrutura canais fixa como na planilha original
  const canaisKeys = [
    "P13 Venda Direta", "Portaria", "P05", "VAZIO",
    "P13 - Venda Disk", "P13 - Comercio", "Whats e App", "P13 - Venda PV",
    "P20 Indl.", "P45 Indl.", "Água", "VZ Agua + Registro",
  ];
  const canalTotais: Record<string, { qtde: number; total: number; custo: number }> = {};
  canaisKeys.forEach((k) => canalTotais[k] = { qtde: 0, total: 0, custo: 0 });

  function classificarLinha(canal: string, tipo: string | null): string | null {
    const c = (canal || "").toLowerCase();
    if (tipo === "P20") return "P20 Indl.";
    if (tipo === "P45") return "P45 Indl.";
    if (tipo === "P05") return "P05";
    if (tipo === "VAZIO") return "VAZIO";
    if (tipo === "Água") return c.includes("vaz") ? "VZ Agua + Registro" : "Água";
    if (tipo === "P13") {
      if (c.includes("portaria") || c.includes("balc")) return "Portaria";
      if (c.includes("disk") || c.includes("tele")) return "P13 - Venda Disk";
      if (c.includes("comerc")) return "P13 - Comercio";
      if (c.includes("whats") || c.includes("app")) return "Whats e App";
      if (c.includes("pv") || c.includes("porta")) return "P13 - Venda PV";
      return "P13 Venda Direta";
    }
    return null;
  }

  (pedidosRes.data || []).forEach((ped: any) => {
    const canal = ped.canal_venda || "Venda Direta";
    (ped.pedido_itens || []).forEach((it: any) => {
      const p: any = prodMap.get(it.produto_id);
      const nome = p?.nome || "";
      const tipo = classificarProduto(nome);
      const linha = classificarLinha(canal, tipo);
      if (!linha) return;
      const qty = Number(it.quantidade) || 0;
      const preco = Number(it.preco_unitario) || Number(p?.preco) || 0;
      const custo = Number(p?.preco_custo) || 0;
      canalTotais[linha].qtde += qty;
      canalTotais[linha].total += qty * preco;
      canalTotais[linha].custo += qty * custo;
    });
  });

  // Despesas categorizadas
  const despesas: Record<string, number> = {};
  const push = (k: string, v: number) => { despesas[k] = (despesas[k] || 0) + v; };
  (cpRes.data || []).forEach((c: any) => push((c.categoria || c.descricao || "Diversos").toString(), Number(c.valor) || 0));
  (mcRes.data || []).forEach((c: any) => push((c.categoria || c.descricao || "Diversos").toString(), Number(c.valor) || 0));
  (dcRes.data || []).forEach((c: any) => push((c.categoria || c.descricao || "Diversos").toString(), Number(c.valor) || 0));

  // Preços de compra médios por tipo
  const custoMedio = (tipo: string) => {
    const filhos = produtos.filter((p: any) => classificarProduto(p.nome) === tipo);
    const vals = filhos.map((p: any) => Number(p.preco_custo) || 0).filter((v: number) => v > 0);
    return vals.length ? vals.reduce((s: number, v: number) => s + v, 0) / vals.length : 0;
  };
  const precosCompra = {
    agua: custoMedio("Água"),
    vzAgua: 13,
    p05: custoMedio("P05"),
    p20: custoMedio("P20"),
    p45: custoMedio("P45"),
    p13: custoMedio("P13"),
    valorVendaP13: (() => {
      const p13 = produtos.find((p: any) => classificarProduto(p.nome) === "P13");
      return Number(p13?.preco) || 0;
    })(),
  };

  return { canalTotais, canaisKeys, despesas, ajustes, precosCompra };
}

function set(ws: any, cell: string, v: any, opts: { bold?: boolean; fill?: string; num?: string; align?: string } = {}) {
  const isFormula = typeof v === "string" && v.startsWith("=");
  const t = isFormula ? "n" : (typeof v === "number" ? "n" : "s");
  const obj: any = isFormula ? { t: "n", f: v.substring(1) } : { t, v };
  const s: any = {};
  if (opts.bold) s.font = { bold: true };
  if (opts.fill) s.fill = { patternType: "solid", fgColor: { rgb: opts.fill } };
  if (opts.num) s.numFmt = opts.num;
  if (opts.align) s.alignment = { horizontal: opts.align };
  if (Object.keys(s).length) obj.s = s;
  ws[cell] = obj;
}

function buildSheet(dados: any, unidadeNome: string, ano: number, mes: number) {
  const ws: any = {};
  const merges: any[] = [];

  // Título
  set(ws, "E2", `RESULTADO OPERACIONAL ${MESES[mes - 1].toUpperCase()} ${ano}`, { bold: true, align: "center" });
  merges.push({ s: { r: 1, c: 4 }, e: { r: 1, c: 10 } });

  // Representante
  set(ws, "B6", "REPRESENTANTE:", { bold: true });
  set(ws, "C6", unidadeNome);

  // Cabeçalhos linha 8
  const headers8: [string, string][] = [
    ["B8", "Custos / Despesas"], ["C8", "Valores"],
    ["E8", "Canal"], ["F8", "Qtde.P13"], ["G8", "Preço Venda"], ["H8", "Total R$"],
    ["I8", "Preço Compra"], ["J8", "MC R$"], ["K8", "Tonelagem"],
    ["M8", "Entradas"], ["N8", ""], ["O8", ""], ["P8", "Saídas"], ["R8", "Investimentos"],
  ];
  headers8.forEach(([c, v]) => set(ws, c, v, { bold: true, fill: "E5E7EB" }));

  // Bloco 1 — Custos (B/C) - dinâmico
  const despLinhas = Object.entries(dados.despesas)
    .filter(([_, v]: any) => Number(v) > 0)
    .sort((a: any, b: any) => Number(b[1]) - Number(a[1]));
  const custosStartRow = 9;
  let r = custosStartRow;
  despLinhas.forEach(([nome, valor]: any) => {
    set(ws, `B${r}`, nome);
    set(ws, `C${r}`, Number(valor), { num: "#,##0.00" });
    r++;
  });
  const custosEndRow = r - 1;
  const totalCustosRow = r + 1;
  set(ws, `B${totalCustosRow}`, "Total", { bold: true, fill: "FEF3C7" });
  const totalCustosFormula = custosEndRow >= custosStartRow ? `=SUM(C${custosStartRow}:C${custosEndRow})` : "=0";
  set(ws, `C${totalCustosRow}`, totalCustosFormula, { bold: true, fill: "FEF3C7", num: "#,##0.00" });

  // Bloco 2 — Vendas por canal (E..K), linhas 9..(9+canais-1)
  const canaisKeys = dados.canaisKeys;
  const canalStart = 9;
  canaisKeys.forEach((canal: string, idx: number) => {
    const row = canalStart + idx;
    const dados_c = dados.canalTotais[canal];
    set(ws, `E${row}`, canal);
    set(ws, `F${row}`, dados_c.qtde);
    // Preço venda unitário: total/qtde
    set(ws, `G${row}`, dados_c.qtde > 0 ? Number((dados_c.total / dados_c.qtde).toFixed(4)) : 0, { num: "#,##0.00" });
    // Total = F*G
    set(ws, `H${row}`, `=F${row}*G${row}`, { num: "#,##0.00" });
    // Preço compra unitário
    set(ws, `I${row}`, dados_c.qtde > 0 ? Number((dados_c.custo / dados_c.qtde).toFixed(4)) : 0, { num: "#,##0.00" });
    // MC = H - (I*F)
    set(ws, `J${row}`, `=H${row}-(I${row}*F${row})`, { num: "#,##0.00" });
    // Tonelagem
    const tipoTon = canal.includes("P13") || canal === "Portaria" || canal === "Whats e App" ? 13
      : canal.includes("P20") ? 20
      : canal.includes("P45") ? 45
      : canal === "P05" ? 5 : 0;
    set(ws, `K${row}`, tipoTon > 0 ? `=F${row}*${tipoTon}/1000` : 0, { num: "#,##0.000" });
  });
  const canalEnd = canalStart + canaisKeys.length - 1;
  const totalRow = canalEnd + 2;
  set(ws, `E${totalRow}`, "Total", { bold: true, fill: "FEF3C7" });
  set(ws, `F${totalRow}`, `=SUM(F${canalStart}:F${canalEnd})`, { bold: true, fill: "FEF3C7" });
  set(ws, `H${totalRow}`, `=SUM(H${canalStart}:H${canalEnd})`, { bold: true, fill: "FEF3C7", num: "#,##0.00" });
  set(ws, `I${totalRow}`, `=SUM(I${canalStart}:I${canalEnd})`, { fill: "FEF3C7", num: "#,##0.00" });
  set(ws, `J${totalRow}`, `=SUM(J${canalStart}:J${canalEnd})`, { bold: true, fill: "FEF3C7", num: "#,##0.00" });
  set(ws, `K${totalRow}`, `=SUM(K${canalStart}:K${canalEnd})`, { bold: true, fill: "FEF3C7", num: "#,##0.000" });

  // Bloco 3 — Consolidado (E-F)
  const consStart = totalRow + 2;
  const consLabels: [string, string][] = [
    ["Receita Bruta", `=H${totalRow}`],
    ["(-) Custo Mat. Prima", `=SUMPRODUCT(I${canalStart}:I${canalEnd},F${canalStart}:F${canalEnd})`],
    ["Lucro Bruto", `=F${consStart}-F${consStart + 1}`],
    ["(-) Custo / Despesa", `=C${totalCustosRow}`],
    ["Lucro Líquido", `=F${consStart + 2}-F${consStart + 3}`],
    ["Nota Crédito", String(dados.ajustes.nota_credito || 0)],
    ["RESULTADO", `=F${consStart + 4}+F${consStart + 5}`],
  ];
  consLabels.forEach(([label, formula], i) => {
    const row = consStart + i;
    const isResult = label === "RESULTADO";
    const isLucro = label.includes("Lucro");
    set(ws, `E${row}`, label, { bold: isResult || isLucro, fill: isResult ? "DCFCE7" : (isLucro ? "F1F5F9" : undefined) });
    const isFormula = formula.startsWith("=");
    if (isFormula) {
      set(ws, `F${row}`, formula, { bold: isResult || isLucro, fill: isResult ? "DCFCE7" : (isLucro ? "F1F5F9" : undefined), num: "#,##0.00" });
    } else {
      set(ws, `F${row}`, Number(formula), { num: "#,##0.00" });
    }
  });

  // Ponto de Equilíbrio
  const peRow = consStart + consLabels.length + 1;
  set(ws, `E${peRow}`, "Ponto de Equilíbrio (un.)", { bold: true });
  // PE = TotalCustos / (PVendaP13 - PCompraP13); usando F/G/I do primeiro canal P13 quando possível
  const p13Row = canalStart; // P13 Venda Direta
  set(ws, `F${peRow}`, `=IFERROR(C${totalCustosRow}/(G${p13Row}-I${p13Row}),0)`, { bold: true, num: "#,##0" });

  // Bloco 4 — Entradas (M/O)
  const entradas: [string, string, number][] = [
    ["Dinheiro", "dinheiro", 0],
    ["Cheque Pré + Cheque à Vista", "cheque", 0],
    ["Cheque Devolvido", "cheque_devolvido", 0],
    ["Estoque P05", "estoque_p05", 0],
    ["Estoque P13", "estoque_p13", 0],
    ["Estoque P20", "estoque_p20", 0],
    ["Estoque P45", "estoque_p45", 0],
    ["Estoque Água", "estoque_agua", 0],
    ["Saldo Uniprime", "saldo_uniprime", 0],
    ["Saldo B. Brasil", "saldo_bb", 0],
    ["Crédito B. Brasil", "credito_bb", 0],
    ["Azul Gás e Inter", "azul_inter", 0],
    ["Saldo Santander", "saldo_santander", 0],
    ["Cartão", "cartao", 0],
    ["Pendências", "pendencias", 0],
    ["Boletos", "boletos", 0],
    ["Vale Ultragaz P13", "vale_p13", 0],
    ["Vale Ultragaz P45", "vale_p45", 0],
    ["Fernando ABM Gás", "fernando_abm", 0],
  ];
  const entStart = 11;
  entradas.forEach(([label, chave], i) => {
    const row = entStart + i;
    set(ws, `M${row}`, label);
    set(ws, `O${row}`, Number(dados.ajustes[chave] || 0), { num: "#,##0.00" });
  });
  const entEnd = entStart + entradas.length - 1;
  const entTotalRow = entEnd + 2;
  set(ws, `M${entTotalRow}`, "Total Entradas", { bold: true, fill: "DBEAFE" });
  set(ws, `O${entTotalRow}`, `=SUM(O${entStart}:O${entEnd})`, { bold: true, fill: "DBEAFE", num: "#,##0.00" });

  // Saídas (P)
  const saidas: [string, string][] = [
    ["Saídas Diversas", "saidas"],
  ];
  const saidaStart = 11;
  saidas.forEach(([label, chave], i) => {
    const row = saidaStart + i;
    set(ws, `P${row}`, label);
    set(ws, `Q${row}`, Number(dados.ajustes[chave] || 0), { num: "#,##0.00" });
  });
  const saidaTotalRow = saidaStart + saidas.length + 1;
  set(ws, `P${saidaTotalRow}`, "Total Saídas", { bold: true, fill: "FEE2E2" });
  set(ws, `Q${saidaTotalRow}`, `=SUM(Q${saidaStart}:Q${saidaStart + saidas.length - 1})`, { bold: true, fill: "FEE2E2", num: "#,##0.00" });

  // Investimentos (R)
  const investRow = 11;
  set(ws, `R${investRow}`, "Investimentos");
  set(ws, `S${investRow}`, Number(dados.ajustes.investimentos || 0), { num: "#,##0.00" });

  // Resultado do fluxo lateral
  set(ws, `M${entTotalRow + 2}`, "Resultado (Entradas - Saídas)", { bold: true });
  set(ws, `O${entTotalRow + 2}`, `=O${entTotalRow}-Q${saidaTotalRow}`, { bold: true, num: "#,##0.00" });

  // Preços de referência (B36..C46)
  const refStart = 36;
  const refs: [string, number | string][] = [
    ["Dados do Representante", ""],
    ["Prazo de Faturamento:", "12 DDL"],
    ["Preço Compra Água", dados.precosCompra.agua],
    ["Preço Compra Vz Água", dados.precosCompra.vzAgua],
    ["Preço Compra P05", dados.precosCompra.p05],
    ["Preço Compra P20", dados.precosCompra.p20],
    ["Preço Compra P45", dados.precosCompra.p45],
    ["Preço Compra NT P13", dados.precosCompra.p13],
    ["Valor Venda P.13", dados.precosCompra.valorVendaP13],
  ];
  refs.forEach(([label, val], i) => {
    const row = refStart + i;
    set(ws, `B${row}`, label, { bold: i === 0 });
    if (val !== "") set(ws, `C${row}`, typeof val === "number" ? Number(val) : val, { num: typeof val === "number" ? "#,##0.00" : undefined });
  });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: entTotalRow + 4, c: 20 } });
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 2 }, { wch: 30 }, { wch: 14 }, { wch: 2 },
    { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 2 }, { wch: 22 }, { wch: 2 }, { wch: 12 }, { wch: 2 }, { wch: 18 }, { wch: 12 }, { wch: 2 }, { wch: 16 }, { wch: 12 },
  ];
  return ws;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userUnid } = await admin.from("user_unidades").select("unidade_id")
      .eq("user_id", userData.user.id).eq("unidade_id", parsed.data.unidade_id).maybeSingle();
    const { data: unidade } = await admin.from("unidades").select("id, nome").eq("id", parsed.data.unidade_id).maybeSingle();
    if (!unidade) {
      return new Response(JSON.stringify({ error: "Unidade não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!userUnid) {
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
      const roles = (roleRow || []).map((r: any) => r.role);
      if (!roles.includes("gestor") && !roles.includes("admin")) {
        return new Response(JSON.stringify({ error: "Sem acesso à unidade" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const wb = XLSX.utils.book_new();
    for (let m = 1; m <= 12; m++) {
      const dados = await montarROMes(admin, parsed.data.unidade_id, parsed.data.ano, m);
      const ws = buildSheet(dados, unidade.nome, parsed.data.ano, m);
      XLSX.utils.book_append_sheet(wb, ws, MESES[m - 1]);
    }

    const out: Uint8Array = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
    let bin = "";
    for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
    const b64 = btoa(bin);

    return new Response(JSON.stringify({ file: b64, unidade: unidade.nome, ano: parsed.data.ano }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("gerar-ro-excel", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
