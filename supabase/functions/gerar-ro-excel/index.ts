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
  if (n.includes("p13") || n.includes("13kg")) return "p13";
  if (n.includes("p20") || n.includes("20kg")) return "P20";
  if (n.includes("p45") || n.includes("45kg")) return "P45";
  if (n.includes("p05") || n.includes("5kg")) return "P05";
  if (n.includes("água") || n.includes("agua")) return "Água";
  if ((n.includes("galão") || n.includes("galao")) && n.includes("vazio")) return "VAZIO";
  return null;
}

function pesoKg(nome: string): number {
  const t = classificarProduto(nome);
  if (t === "p13") return 13;
  if (t === "P20") return 20;
  if (t === "P45") return 45;
  if (t === "P05") return 5;
  return 0;
}

async function montarROMes(supabase: any, unidadeId: string, ano: number, mes: number) {
  // mes: 1..12
  const inicio = new Date(ano, mes - 1, 1).toISOString();
  const fim = new Date(ano, mes, 0, 23, 59, 59).toISOString();
  const inicioDate = inicio.substring(0, 10);
  const fimDate = fim.substring(0, 10);

  const [pedidosRes, prodRes, cpRes, mcRes, ajRes] = await Promise.all([
    supabase.from("pedidos")
      .select("id, valor_total, canal_venda, status, pedido_itens(quantidade, preco_unitario, produto_id)")
      .eq("unidade_id", unidadeId)
      .gte("created_at", inicio).lte("created_at", fim)
      .neq("status", "cancelado"),
    supabase.from("produtos").select("id, nome, preco_custo, preco").eq("unidade_id", unidadeId),
    supabase.from("contas_pagar").select("valor, categoria, descricao")
      .eq("unidade_id", unidadeId).eq("status", "pago")
      .gte("vencimento", inicioDate).lte("vencimento", fimDate),
    supabase.from("movimentacoes_caixa").select("valor, categoria, descricao, tipo, status")
      .eq("unidade_id", unidadeId).eq("tipo", "saida").neq("status", "rejeitada")
      .is("compra_id", null).is("pedido_id", null)
      .gte("created_at", inicio).lte("created_at", fim),
    supabase.from("ro_ajustes_mensais").select("chave, valor")
      .eq("unidade_id", unidadeId).eq("ano", ano).eq("mes", mes),
  ]);

  const produtos = prodRes.data || [];
  const prodMap = new Map(produtos.map((p: any) => [p.id, p]));
  const ajustes: Record<string, number> = {};
  (ajRes.data || []).forEach((a: any) => { ajustes[a.chave] = Number(a.valor) || 0; });

  // Vendas por canal (P13) e produtos
  const canalMap: Record<string, { qtde: number; total: number; custo: number; ton: number }> = {};
  const prodTotais: Record<string, { qtde: number; total: number; custo: number; ton: number }> = {};

  (pedidosRes.data || []).forEach((ped: any) => {
    const canal = ped.canal_venda || "Venda Direta";
    (ped.pedido_itens || []).forEach((it: any) => {
      const p: any = prodMap.get(it.produto_id);
      const nome = p?.nome || "";
      const tipo = classificarProduto(nome);
      const qty = Number(it.quantidade) || 0;
      const preco = Number(it.preco_unitario) || Number(p?.preco) || 0;
      const custo = Number(p?.preco_custo) || 0;
      const total = qty * preco;
      const ton = qty * pesoKg(nome) / 1000;
      if (tipo === "p13") {
        if (!canalMap[canal]) canalMap[canal] = { qtde: 0, total: 0, custo: 0, ton: 0 };
        canalMap[canal].qtde += qty;
        canalMap[canal].total += total;
        canalMap[canal].custo += qty * custo;
        canalMap[canal].ton += ton;
      } else if (tipo) {
        if (!prodTotais[tipo]) prodTotais[tipo] = { qtde: 0, total: 0, custo: 0, ton: 0 };
        prodTotais[tipo].qtde += qty;
        prodTotais[tipo].total += total;
        prodTotais[tipo].custo += qty * custo;
        prodTotais[tipo].ton += ton;
      }
    });
  });

  // Despesas por categoria
  const despesas: Record<string, number> = {};
  (cpRes.data || []).forEach((c: any) => {
    const k = (c.categoria || c.descricao || "Diversos").toString();
    despesas[k] = (despesas[k] || 0) + (Number(c.valor) || 0);
  });
  (mcRes.data || []).forEach((c: any) => {
    const k = (c.categoria || c.descricao || "Diversos").toString();
    despesas[k] = (despesas[k] || 0) + (Number(c.valor) || 0);
  });

  return { canalMap, prodTotais, despesas, ajustes };
}

function buildSheet(dados: any, ano: number, mes: number) {
  const rows: any[][] = [];
  rows.push([]);
  rows.push([`RESULTADO OPERACIONAL — ${MESES[mes - 1]} ${ano}`]);
  rows.push([]);

  // Cabeçalho vendas
  rows.push(["", "CUSTOS / DESPESAS", "Valores", "", "Canal", "Qtde P13", "Preço Venda", "Total R$", "Preço Compra", "MC R$", "Tonelagem"]);

  const canalLinhas = Object.entries(dados.canalMap).map(([canal, d]: any) => ({
    canal,
    qtde: d.qtde,
    pVenda: d.qtde > 0 ? d.total / d.qtde : 0,
    total: d.total,
    pCompra: d.qtde > 0 ? d.custo / d.qtde : 0,
    mc: d.total - d.custo,
    ton: d.ton,
  }));
  const prodLinhas = Object.entries(dados.prodTotais).map(([nome, d]: any) => ({
    canal: nome,
    qtde: d.qtde,
    pVenda: d.qtde > 0 ? d.total / d.qtde : 0,
    total: d.total,
    pCompra: d.qtde > 0 ? d.custo / d.qtde : 0,
    mc: d.total - d.custo,
    ton: d.ton,
  }));
  const linhasVendas = [...canalLinhas, ...prodLinhas];

  const despLinhas = Object.entries(dados.despesas)
    .filter(([_, v]: any) => Number(v) > 0)
    .sort((a: any, b: any) => Number(b[1]) - Number(a[1]));

  const totalCustos = despLinhas.reduce((s: number, [_, v]: any) => s + Number(v), 0);
  const receita = linhasVendas.reduce((s, l) => s + l.total, 0);
  const custoMP = linhasVendas.reduce((s, l) => s + (l.pCompra * l.qtde), 0);
  const lucroBruto = receita - custoMP;
  const lucroLiquido = lucroBruto - totalCustos;
  const totalTon = linhasVendas.reduce((s, l) => s + l.ton, 0);
  const totalQtd = linhasVendas.reduce((s, l) => s + l.qtde, 0);
  const mcUnit = totalQtd > 0 ? (receita - custoMP) / totalQtd : 0;
  const pEquilibrio = mcUnit > 0 ? Math.ceil(totalCustos / mcUnit) : 0;

  const maxLinhas = Math.max(despLinhas.length, linhasVendas.length);
  for (let i = 0; i < maxLinhas; i++) {
    const d: any = despLinhas[i];
    const v: any = linhasVendas[i];
    rows.push([
      "",
      d ? d[0] : "",
      d ? Number(d[1]) : "",
      "",
      v ? v.canal : "",
      v ? v.qtde : "",
      v ? Number(v.pVenda.toFixed(2)) : "",
      v ? Number(v.total.toFixed(2)) : "",
      v ? Number(v.pCompra.toFixed(2)) : "",
      v ? Number(v.mc.toFixed(2)) : "",
      v ? Number(v.ton.toFixed(3)) : "",
    ]);
  }

  rows.push([]);
  rows.push(["", "TOTAL DESPESAS", totalCustos, "", "Total", totalQtd, "", receita, "", lucroBruto, totalTon]);
  rows.push([]);
  rows.push(["", "", "", "", "Receita Bruta", "", "", receita]);
  rows.push(["", "", "", "", "(-) Custo Mat. Prima", "", "", custoMP]);
  rows.push(["", "", "", "", "Lucro Bruto", "", "", lucroBruto]);
  rows.push(["", "", "", "", "(-) Custo / Despesa", "", "", totalCustos]);
  rows.push(["", "", "", "", "Lucro Líquido", "", "", lucroLiquido]);
  rows.push(["", "", "", "", "Nota Crédito", "", "", dados.ajustes.nota_credito || 0]);
  rows.push(["", "", "", "", "RESULTADO", "", "", lucroLiquido + (dados.ajustes.nota_credito || 0)]);
  rows.push([]);
  rows.push(["", "", "", "", "Ponto de Equilíbrio (un.)", pEquilibrio]);
  rows.push([]);
  rows.push(["", "AJUSTES", "", "", "Saídas", dados.ajustes.saidas || 0]);
  rows.push(["", "", "", "", "Investimentos", dados.ajustes.investimentos || 0]);
  rows.push(["", "", "", "", "Pendências", dados.ajustes.pendencias || 0]);
  rows.push(["", "", "", "", "Fernando ABM Gás", dados.ajustes.fernando_abm || 0]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 2 }, { wch: 30 }, { wch: 14 }, { wch: 2 },
    { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
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

    // Autoriza: usuário deve ter acesso à unidade
    const { data: userUnid } = await admin.from("user_unidades").select("unidade_id")
      .eq("user_id", userData.user.id).eq("unidade_id", parsed.data.unidade_id).maybeSingle();
    const { data: unidade } = await admin.from("unidades").select("id, nome").eq("id", parsed.data.unidade_id).maybeSingle();
    if (!unidade) {
      return new Response(JSON.stringify({ error: "Unidade não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!userUnid) {
      // gestor/admin pode passar; validação simples via role
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
      const roles = (roleRow || []).map((r: any) => r.role);
      if (!roles.includes("gestor") && !roles.includes("admin")) {
        return new Response(JSON.stringify({ error: "Sem acesso à unidade" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const wb = XLSX.utils.book_new();
    // Gera todas as 12 abas, destaca a solicitada
    for (let m = 1; m <= 12; m++) {
      const dados = await montarROMes(admin, parsed.data.unidade_id, parsed.data.ano, m);
      const ws = buildSheet(dados, parsed.data.ano, m);
      XLSX.utils.book_append_sheet(wb, ws, MESES[m - 1]);
    }

    const out: Uint8Array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    // to base64
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
