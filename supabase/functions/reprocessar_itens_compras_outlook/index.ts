// Reprocessa as compras importadas do Outlook que ficaram sem `compra_itens`.
// Relê o XML salvo em `compras.xml_content`, cria/localiza produtos e insere itens
// + movimentações de estoque com a parte fiscal completa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}
function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = []; let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function num(s: string | null): number { return parseFloat(s || "0") || 0; }

interface ParsedItem {
  xProd: string; cProd: string; ncm: string; cest: string; cfop: string;
  uCom: string; qCom: number; vUnCom: number; vDesc: number; vProd: number;
  cProdANP: string; cst_icms: string; csosn_icms: string;
  aliquota_icms: number; valor_icms: number;
  cst_pis: string; aliquota_pis: number; valor_pis: number;
  cst_cofins: string; aliquota_cofins: number; valor_cofins: number;
}

function parseItens(xml: string): ParsedItem[] {
  const itens: ParsedItem[] = [];
  for (const det of pickAll(xml, "det")) {
    const prodMatch = det.match(/<prod[^>]*>([\s\S]*?)<\/prod>/i);
    if (!prodMatch) continue;
    const prod = prodMatch[1];
    const impMatch = det.match(/<imposto[^>]*>([\s\S]*?)<\/imposto>/i);
    const imp = impMatch ? impMatch[1] : "";
    const icmsBlock = (imp.match(/<ICMS[^>]*>([\s\S]*?)<\/ICMS>/i) || ["",""])[1];
    const pisBlock = (imp.match(/<PIS[^>]*>([\s\S]*?)<\/PIS>/i) || ["",""])[1];
    const cofinsBlock = (imp.match(/<COFINS[^>]*>([\s\S]*?)<\/COFINS>/i) || ["",""])[1];
    const combBlock = (prod.match(/<comb[^>]*>([\s\S]*?)<\/comb>/i) || ["",""])[1];
    itens.push({
      xProd: pick(prod, "xProd") || "",
      cProd: pick(prod, "cProd") || "",
      ncm: pick(prod, "NCM") || "",
      cest: pick(prod, "CEST") || "",
      cfop: pick(prod, "CFOP") || "",
      uCom: pick(prod, "uCom") || "",
      qCom: num(pick(prod, "qCom")),
      vUnCom: num(pick(prod, "vUnCom")),
      vDesc: num(pick(prod, "vDesc")),
      vProd: num(pick(prod, "vProd")),
      cProdANP: pick(combBlock, "cProdANP") || "",
      cst_icms: pick(icmsBlock, "CST") || "",
      csosn_icms: pick(icmsBlock, "CSOSN") || "",
      aliquota_icms: num(pick(icmsBlock, "pICMS")),
      valor_icms: num(pick(icmsBlock, "vICMS")),
      cst_pis: pick(pisBlock, "CST") || "",
      aliquota_pis: num(pick(pisBlock, "pPIS")),
      valor_pis: num(pick(pisBlock, "vPIS")),
      cst_cofins: pick(cofinsBlock, "CST") || "",
      aliquota_cofins: num(pick(cofinsBlock, "pCOFINS")),
      valor_cofins: num(pick(cofinsBlock, "vCOFINS")),
    });
  }
  return itens;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supaUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("user_id", user.id).single();
    const empresa_id = profile?.empresa_id;
    if (!empresa_id) return new Response(JSON.stringify({ ok: false, error: "Usuário sem empresa" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Lista unidades da empresa para restringir e descobrir candidatas com xml e sem itens
    const { data: unidades } = await supabase.from("unidades").select("id").eq("empresa_id", empresa_id);
    const unidadeIds = (unidades || []).map((u: any) => u.id);
    if (unidadeIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, total: 0, processadas: 0, itens_criados: 0, produtos_criados: 0, erros: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: compras } = await supabase
      .from("compras")
      .select("id, unidade_id, numero_nota_fiscal, xml_content")
      .in("unidade_id", unidadeIds)
      .not("xml_content", "is", null)
      .like("observacoes", "Importado do Outlook%");

    // Filtra: só as que NÃO têm itens
    const candidatas: any[] = [];
    for (const c of (compras || [])) {
      const { count } = await supabase.from("compra_itens").select("id", { count: "exact", head: true }).eq("compra_id", c.id);
      if ((count || 0) === 0) candidatas.push(c);
    }

    let processadas = 0, itens_criados = 0, produtos_criados = 0, erros = 0;
    const detalhes: any[] = [];

    const vasilhameCfops = new Set(["1913","1914","2913","2914","5913","5914","6913","6914","5920","5921","6920","6921","1920","1921","2920","2921"]);

    for (const c of candidatas) {
      try {
        const itens = parseItens(c.xml_content as string);
        if (itens.length === 0) { detalhes.push({ nf: c.numero_nota_fiscal, status: "sem itens no XML" }); continue; }

        // Pula NF de vasilhame (retorno/remessa)
        const natOp = (pick(c.xml_content as string, "natOp") || "").toLowerCase();
        const cfopsAll = itens.map(i => (i.cfop || "").replace(/\D/g, "")).filter(Boolean);
        const isVasilhame = cfopsAll.some(cf => vasilhameCfops.has(cf))
          || /vasilhame|botij[ãa]o vazio|comodato/i.test(natOp)
          || (/retorno|remessa/i.test(natOp) && !/venda|compra/i.test(natOp));
        if (isVasilhame) { detalhes.push({ nf: c.numero_nota_fiscal, status: "ignorado (vasilhame/retorno/remessa)" }); continue; }

        // produtos da unidade
        const { data: produtos } = await supabase.from("produtos").select("id, nome, estoque").eq("unidade_id", c.unidade_id);
        const findProduto = (nome: string) => {
          const n = nome.toLowerCase();
          return (produtos || []).find((p: any) => p.nome.toLowerCase() === n || p.nome.toLowerCase().includes(n) || n.includes(p.nome.toLowerCase()));
        };

        const itensInsert: any[] = [];
        for (const item of itens) {
          let produto_id: string | null = null;
          const found = findProduto(item.xProd);
          if (found) produto_id = (found as any).id;
          else {
            const isMonofasico = (item.cst_pis === "04" || item.cst_cofins === "04" || (item.cProdANP || "").startsWith("21"));
            const isGas = /g[áa]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45/i.test(item.xProd);
            const full: any = {
              nome: item.xProd, preco: item.vUnCom, ativo: true, unidade_id: c.unidade_id,
              categoria: isGas ? "gas" : null,
              ncm: item.ncm || null, cest: item.cest || null,
              cfop_entrada_padrao: item.cfop || null, codigo_anp: item.cProdANP || null,
              cst_icms: item.cst_icms || null, csosn_icms: item.csosn_icms || null,
              cst_pis: item.cst_pis || null, cst_cofins: item.cst_cofins || null,
              aliquota_pis: item.aliquota_pis || null, aliquota_cofins: item.aliquota_cofins || null,
              unidade_tributavel: item.uCom || null, monofasico: isMonofasico,
            };
            let r = await supabase.from("produtos").insert(full).select("id").single();
            if (r.error) {
              const minimal = { nome: item.xProd, preco: item.vUnCom, ativo: true, unidade_id: c.unidade_id, categoria: isGas ? "gas" : null };
              r = await supabase.from("produtos").insert(minimal).select("id").single();
              if (r.error) { console.warn("produto fail:", r.error.message); continue; }
            }
            produto_id = r.data.id;
            produtos_criados++;
          }
          if (!produto_id) continue;

          const qtd = Math.max(1, Math.round(item.qCom));
          itensInsert.push({
            compra_id: c.id, produto_id, quantidade: qtd, preco_unitario: item.vUnCom,
            descricao_xml: item.xProd, codigo_produto_fornecedor: item.cProd || null,
            unidade_xml: item.uCom || null, ncm: item.ncm || null, cest: item.cest || null,
            cfop: item.cfop || null, codigo_anp: item.cProdANP || null,
            cst_icms: item.cst_icms || null, csosn_icms: item.csosn_icms || null,
            cst_pis: item.cst_pis || null, cst_cofins: item.cst_cofins || null,
            aliquota_icms: item.aliquota_icms || null, aliquota_pis: item.aliquota_pis || null,
            aliquota_cofins: item.aliquota_cofins || null,
            valor_icms: item.valor_icms || null, valor_pis: item.valor_pis || null,
            valor_cofins: item.valor_cofins || null, valor_desconto: item.vDesc || null,
          });
        }

        if (itensInsert.length) {
          const { error: iErr } = await supabase.from("compra_itens").insert(itensInsert);
          if (iErr) { erros++; detalhes.push({ nf: c.numero_nota_fiscal, status: "erro itens: " + iErr.message }); continue; }
          itens_criados += itensInsert.length;

          for (const it of itensInsert) {
            const { data: prod } = await supabase.from("produtos").select("estoque").eq("id", it.produto_id).single();
            if (prod) {
              await supabase.from("produtos").update({ estoque: (prod.estoque || 0) + it.quantidade }).eq("id", it.produto_id);
              await supabase.from("movimentacoes_estoque").insert({
                produto_id: it.produto_id, tipo: "entrada", quantidade: it.quantidade,
                observacoes: `Reprocessamento NF ${c.numero_nota_fiscal || ""} (Outlook)`,
                unidade_id: c.unidade_id,
              });
            }
          }
        }
        processadas++;
        detalhes.push({ nf: c.numero_nota_fiscal, itens: itensInsert.length, status: "ok" });
      } catch (e: any) {
        erros++;
        detalhes.push({ nf: c.numero_nota_fiscal, status: "erro: " + e.message });
      }
    }

    return new Response(JSON.stringify({
      ok: true, total: candidatas.length, processadas, itens_criados, produtos_criados, erros,
      detalhes: detalhes.slice(0, 50),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("reprocessar_itens_compras_outlook ERRO:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
