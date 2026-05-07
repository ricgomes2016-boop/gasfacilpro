import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pick(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}
function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function normalizeCnpj(s: string | null): string {
  return (s || "").replace(/\D/g, "");
}

function classificarTipo(cfop: string | null, descricao: string): "cheio" | "vasilhame" | "outros" {
  const desc = descricao.toLowerCase();
  if (/vasilhame|vazio|botij[aã]o\s+vazio|sem\s+carga/.test(desc)) return "vasilhame";
  const cfopCheio = ["5101","5102","5103","5104","5405","5403","5656","6101","6102","6103","6403","6404","5651","5652","6651","6652"];
  const cfopVasilhame = ["5556","5920","5921","6920","6921"];
  if (cfop && cfopVasilhame.includes(cfop)) return "vasilhame";
  if (cfop && cfopCheio.includes(cfop)) {
    if (/g[aá]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45|13\s*kg|20\s*kg|45\s*kg/.test(desc)) return "cheio";
  }
  if (/g[aá]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45|13\s*kg|20\s*kg|45\s*kg/.test(desc)) return "cheio";
  if (/[áa]gua|gal[ãa]o/.test(desc)) return "outros";
  return "outros";
}

function parseNFeXml(xml: string) {
  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chave_nfe = chaveMatch ? chaveMatch[1] : null;
  const numero_nf = pick(xml, "nNF");
  const dhEmi = pick(xml, "dhEmi") || pick(xml, "dEmi");
  const data = dhEmi ? dhEmi.slice(0, 10) : null;

  const emitMatch = xml.match(/<emit[^>]*>([\s\S]*?)<\/emit>/i);
  const emitXml = emitMatch ? emitMatch[1] : "";
  const fornecedor = pick(emitXml, "xNome");
  const cidade_fornecedor = pick(emitXml, "xMun");

  const destMatch = xml.match(/<dest[^>]*>([\s\S]*?)<\/dest>/i);
  const destXml = destMatch ? destMatch[1] : "";
  const cnpj_destinatario = pick(destXml, "CNPJ") || pick(destXml, "CPF");

  const dupMatch = xml.match(/<dup[^>]*>([\s\S]*?)<\/dup>/i);
  const dupXml = dupMatch ? dupMatch[1] : "";
  const data_vencimento = pick(dupXml, "dVenc");

  const itens: any[] = [];
  const detBlocks = pickAll(xml, "det");
  for (const det of detBlocks) {
    const prodMatch = det.match(/<prod[^>]*>([\s\S]*?)<\/prod>/i);
    if (!prodMatch) continue;
    const prod = prodMatch[1];
    const produto = pick(prod, "xProd") || "";
    const cfop = pick(prod, "CFOP");
    const desconto = parseFloat(pick(prod, "vDesc") || "0");
    itens.push({
      produto, cfop,
      quantidade: parseFloat(pick(prod, "qCom") || "0"),
      preco_unitario: parseFloat(pick(prod, "vUnCom") || "0"),
      valor_total: parseFloat(pick(prod, "vProd") || "0"),
      desconto,
      tipo: classificarTipo(cfop, produto),
    });
  }
  const totalMatch = xml.match(/<ICMSTot[^>]*>([\s\S]*?)<\/ICMSTot>/i);
  const totalXml = totalMatch ? totalMatch[1] : "";
  const valor_total_nota = parseFloat(pick(totalXml, "vNF") || "0");

  if (!numero_nf && !chave_nfe) return null;
  return { chave_nfe, numero_nf, data, fornecedor, cidade_fornecedor, cnpj_destinatario, data_vencimento, itens, valor_total_nota };
}

// Tenta baixar o XML por chave usando serviços públicos.
// Sem certificado digital A1, este caminho é best-effort.
async function tentarBuscarXmlPorChave(chave: string): Promise<string | null> {
  // Tentativa 1: meudanfe (POST público)
  try {
    const r = await fetch("https://ws.meudanfe.com.br/api/v1/get/nfe/xmlToDanfePDF/API", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: chave,
    });
    if (r.ok) {
      const txt = await r.text();
      if (txt && /<NFe|<infNFe/i.test(txt)) return txt;
    }
  } catch (_e) { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabase
      .from("profiles").select("empresa_id").eq("user_id", user.id).single();
    const empresa_id = profile?.empresa_id;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Usuário sem empresa associada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let xml: string | null = (body.xml || "").toString().trim() || null;
    const chaveInput: string = (body.chave || "").toString().replace(/\D/g, "");

    if (!xml && chaveInput) {
      if (chaveInput.length !== 44) {
        return new Response(JSON.stringify({ ok: false, error: "Chave deve ter 44 dígitos" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verifica duplicidade antes de tentar baixar
      const { data: existing } = await supabase
        .from("transp_compras")
        .select("id")
        .eq("empresa_id", empresa_id)
        .eq("chave_nfe", chaveInput)
        .limit(1).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ ok: true, ja_existente: true, message: "Esta nota já está importada." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      xml = await tentarBuscarXmlPorChave(chaveInput);
      if (!xml) {
        return new Response(JSON.stringify({
          ok: false,
          requer_xml: true,
          message: "Não foi possível baixar o XML automaticamente. Cole o conteúdo do XML (baixe no portal da SEFAZ ou no e-mail do fornecedor).",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!xml) {
      return new Response(JSON.stringify({ ok: false, error: "Forneça a chave de acesso (44 dígitos) ou cole o XML." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/<infNFe/i.test(xml)) {
      return new Response(JSON.stringify({ ok: false, error: "XML inválido (não contém infNFe)." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nfe = parseNFeXml(xml);
    if (!nfe) {
      return new Response(JSON.stringify({ ok: false, error: "Falha ao interpretar XML." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: unidades } = await supabase
      .from("unidades").select("id, cnpj").eq("empresa_id", empresa_id);
    const cnpjToUnidade = new Map<string, string>();
    for (const u of (unidades || [])) {
      const c = normalizeCnpj((u as any).cnpj);
      if (c) cnpjToUnidade.set(c, u.id);
    }
    const cnpjDest = normalizeCnpj(nfe.cnpj_destinatario);
    const unidade_id = cnpjDest ? (cnpjToUnidade.get(cnpjDest) || null) : null;

    let inseridos = 0, ja_existentes = 0, erros = 0;
    const detalhes: any[] = [];

    for (const item of nfe.itens) {
      const { data: existing } = await supabase
        .from("transp_compras").select("id")
        .eq("empresa_id", empresa_id)
        .eq("chave_nfe", nfe.chave_nfe || "")
        .eq("produto_descricao", item.produto)
        .maybeSingle();
      if (existing) { ja_existentes++; continue; }

      const desc = item.produto.toLowerCase();
      const isCheio = item.tipo === "cheio";
      const qtd_p13 = isCheio && /p[\s-]?13|13\s*kg/.test(desc) ? item.quantidade : 0;
      const qtd_p20 = isCheio && /p[\s-]?20|20\s*kg/.test(desc) ? item.quantidade : 0;
      const qtd_p45 = isCheio && /p[\s-]?45|45\s*kg/.test(desc) ? item.quantidade : 0;
      const qtd_agua = /[áa]gua|gal[ãa]o/.test(desc) ? item.quantidade : 0;
      const valorLiquido = item.valor_total - item.desconto;

      const { error: insErr } = await supabase.from("transp_compras").insert({
        empresa_id, unidade_id,
        cnpj_destinatario: cnpjDest || null,
        data: nfe.data || new Date().toISOString().slice(0, 10),
        data_vencimento: nfe.data_vencimento || null,
        fornecedor: nfe.fornecedor || "Desconhecido",
        cidade_fornecedor: nfe.cidade_fornecedor,
        chave_nfe: nfe.chave_nfe,
        numero_nf: nfe.numero_nf,
        produto_descricao: item.produto,
        cfop: item.cfop,
        tipo_produto: item.tipo,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto: item.desconto,
        qtd_p13, qtd_p20, qtd_p45, qtd_agua,
        valor_compra: valorLiquido,
        custo_total: valorLiquido,
        custo_logistico_total: 0, custo_combustivel: 0,
        custo_pedagio: 0, custo_refeicao: 0, custo_outros: 0,
        custo_unit_p13: qtd_p13 > 0 ? item.preco_unitario : 0,
        custo_unit_p20: qtd_p20 > 0 ? item.preco_unitario : 0,
        custo_unit_p45: qtd_p45 > 0 ? item.preco_unitario : 0,
        custo_unit_agua: qtd_agua > 0 ? item.preco_unitario : 0,
        distancia_ida_km: 0,
        mes_referencia: (nfe.data || new Date().toISOString().slice(0, 10)).slice(0, 7),
        observacoes: `Importado manualmente · NF ${nfe.numero_nf}`,
      });
      if (insErr) { erros++; detalhes.push({ produto: item.produto, status: "erro: " + insErr.message }); }
      else { inseridos++; detalhes.push({ produto: item.produto, status: "importado" }); }
    }

    return new Response(JSON.stringify({
      ok: true,
      chave_nfe: nfe.chave_nfe,
      numero_nf: nfe.numero_nf,
      data: nfe.data,
      fornecedor: nfe.fornecedor,
      itens: nfe.itens.length,
      inseridos, ja_existentes, erros,
      detalhes,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[importar_nfe_manual] ERRO:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
