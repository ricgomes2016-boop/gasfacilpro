// Importa XMLs de NF-e a partir de anexos de e-mails no Outlook
// e grava em `compras` + `compra_itens` com a parte fiscal completa.
// Espelha a lógica de `importar_xml_outlook` (transportadora) mas escreve
// nas tabelas operacionais de Estoque/Compras.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

// ---------- helpers de parsing ----------
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
function b64decode(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function normCnpj(s: string | null): string { return (s || "").replace(/\D/g, ""); }
function fmtCnpj(c: string): string {
  const d = normCnpj(c);
  if (d.length !== 14) return c;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

interface FiscalItem {
  xProd: string; cProd: string; ncm: string; cest: string; cfop: string;
  uCom: string; qCom: number; vUnCom: number; vDesc: number; vProd: number;
  cProdANP: string; cst_icms: string; csosn_icms: string;
  aliquota_icms: number; valor_icms: number;
  cst_pis: string; aliquota_pis: number; valor_pis: number;
  cst_cofins: string; aliquota_cofins: number; valor_cofins: number;
}
interface ParsedNFe {
  chave: string | null; nNF: string; serie: string; modelo: string;
  natOp: string; data: string | null; dVenc: string | null;
  cnpjEmit: string; razaoEmit: string; fantasiaEmit: string;
  enderEmit: string; cidadeEmit: string; ufEmit: string; foneEmit: string;
  cnpjDest: string;
  vNF: number; vProd: number; vFrete: number; vSeg: number; vDesc: number; vOutro: number;
  vICMS: number; vST: number; vIPI: number; vPIS: number; vCOFINS: number;
  vBC: number; vBCST: number;
  modFrete: string; transpNome: string; transpCnpj: string; placa: string;
  cfopPred: string;
  itens: FiscalItem[];
  xml: string;
}

function parseNFe(xml: string): ParsedNFe | null {
  if (!/<infNFe/i.test(xml)) return null;
  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chave = chaveMatch ? chaveMatch[1] : null;

  const ideMatch = xml.match(/<ide[^>]*>([\s\S]*?)<\/ide>/i);
  const ide = ideMatch ? ideMatch[1] : "";
  const dhEmi = pick(ide, "dhEmi") || pick(ide, "dEmi");
  const data = dhEmi ? dhEmi.slice(0, 10) : null;

  const emitMatch = xml.match(/<emit[^>]*>([\s\S]*?)<\/emit>/i);
  const emit = emitMatch ? emitMatch[1] : "";
  const enderEmitMatch = emit.match(/<enderEmit[^>]*>([\s\S]*?)<\/enderEmit>/i);
  const enderEmit = enderEmitMatch ? enderEmitMatch[1] : "";
  const lograd = [pick(enderEmit, "xLgr") || "", pick(enderEmit, "nro") || ""].filter(Boolean).join(", ");

  const destMatch = xml.match(/<dest[^>]*>([\s\S]*?)<\/dest>/i);
  const dest = destMatch ? destMatch[1] : "";

  const dupMatch = xml.match(/<dup[^>]*>([\s\S]*?)<\/dup>/i);
  const dup = dupMatch ? dupMatch[1] : "";

  const transpMatch = xml.match(/<transp[^>]*>([\s\S]*?)<\/transp>/i);
  const transp = transpMatch ? transpMatch[1] : "";
  const transporta = (transp.match(/<transporta[^>]*>([\s\S]*?)<\/transporta>/i) || ["",""])[1];
  const veicTransp = (transp.match(/<veicTransp[^>]*>([\s\S]*?)<\/veicTransp>/i) || ["",""])[1];

  const totMatch = xml.match(/<ICMSTot[^>]*>([\s\S]*?)<\/ICMSTot>/i);
  const tot = totMatch ? totMatch[1] : "";

  const itens: FiscalItem[] = [];
  const cfops: string[] = [];
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

    const cfop = pick(prod, "CFOP") || "";
    if (cfop) cfops.push(cfop);
    itens.push({
      xProd: pick(prod, "xProd") || "",
      cProd: pick(prod, "cProd") || "",
      ncm: pick(prod, "NCM") || "",
      cest: pick(prod, "CEST") || "",
      cfop,
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

  const cnt: Record<string, number> = {};
  cfops.forEach(c => { cnt[c] = (cnt[c] || 0) + 1; });
  const cfopPred = Object.entries(cnt).sort((a,b) => b[1]-a[1])[0]?.[0] || "";

  if (!pick(ide, "nNF") && !chave) return null;

  return {
    chave,
    nNF: pick(ide, "nNF") || "",
    serie: pick(ide, "serie") || "",
    modelo: pick(ide, "mod") || "",
    natOp: pick(ide, "natOp") || "",
    data,
    dVenc: pick(dup, "dVenc"),
    cnpjEmit: normCnpj(pick(emit, "CNPJ")),
    razaoEmit: pick(emit, "xNome") || "",
    fantasiaEmit: pick(emit, "xFant") || "",
    enderEmit: lograd,
    cidadeEmit: pick(enderEmit, "xMun") || "",
    ufEmit: pick(enderEmit, "UF") || "",
    foneEmit: pick(enderEmit, "fone") || "",
    cnpjDest: normCnpj(pick(dest, "CNPJ") || pick(dest, "CPF")),
    vNF: num(pick(tot, "vNF")),
    vProd: num(pick(tot, "vProd")),
    vFrete: num(pick(tot, "vFrete")),
    vSeg: num(pick(tot, "vSeg")),
    vDesc: num(pick(tot, "vDesc")),
    vOutro: num(pick(tot, "vOutro")),
    vICMS: num(pick(tot, "vICMS")),
    vST: num(pick(tot, "vST")),
    vIPI: num(pick(tot, "vIPI")),
    vPIS: num(pick(tot, "vPIS")),
    vCOFINS: num(pick(tot, "vCOFINS")),
    vBC: num(pick(tot, "vBC")),
    vBCST: num(pick(tot, "vBCST")),
    modFrete: pick(transp, "modFrete") || "",
    transpNome: pick(transporta, "xNome") || "",
    transpCnpj: pick(transporta, "CNPJ") || "",
    placa: pick(veicTransp, "placa") || "",
    cfopPred,
    itens,
    xml,
  };
}

async function outlookFetch(pathOrUrl: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OUTLOOK_KEY = Deno.env.get("MICROSOFT_OUTLOOK_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!OUTLOOK_KEY) throw new Error("Conexão com Outlook não configurada (MICROSOFT_OUTLOOK_API_KEY ausente).");
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl.replace("https://graph.microsoft.com/v1.0", GATEWAY_URL)
    : `${GATEWAY_URL}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": OUTLOOK_KEY },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Outlook API ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
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
      return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabase
      .from("profiles").select("empresa_id").eq("user_id", user.id).single();
    const empresa_id = profile?.empresa_id;
    if (!empresa_id) {
      return new Response(JSON.stringify({ ok: false, error: "Usuário sem empresa associada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mapas auxiliares
    const { data: unidades } = await supabase
      .from("unidades").select("id, cnpj").eq("empresa_id", empresa_id);
    const cnpjToUnidade = new Map<string, string>();
    for (const u of (unidades || [])) {
      const c = normCnpj((u as any).cnpj);
      if (c) cnpjToUnidade.set(c, u.id);
    }

    const { data: fornecedoresDb } = await supabase
      .from("fornecedores").select("id, razao_social, cnpj").eq("empresa_id", empresa_id);
    const fornecedorByCnpj = new Map<string, { id: string; razao_social: string }>();
    for (const f of (fornecedoresDb || [])) {
      const c = normCnpj((f as any).cnpj);
      if (c) fornecedorByCnpj.set(c, { id: (f as any).id, razao_social: (f as any).razao_social });
    }

    const body = await req.json().catch(() => ({}));
    const dias = Math.min(Math.max(parseInt(body.dias ?? "30"), 1), 180);
    const filtroRemetente: string | null = body.filtro_remetente || null;

    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    const filterParts = [`receivedDateTime ge ${desde}`, `hasAttachments eq true`];
    if (filtroRemetente) filterParts.push(`from/emailAddress/address eq '${filtroRemetente}'`);
    const filter = encodeURIComponent(filterParts.join(" and "));
    const select = encodeURIComponent("id,subject,from,receivedDateTime,hasAttachments");
    const orderby = encodeURIComponent("receivedDateTime desc");

    const messages: any[] = [];
    let next: string | null = `/me/messages?$filter=${filter}&$select=${select}&$orderby=${orderby}&$top=100`;
    let pages = 0;
    while (next && pages < 20) {
      const list: any = await outlookFetch(next);
      messages.push(...(list.value || []).filter((m: any) => m.hasAttachments === true));
      next = list["@odata.nextLink"] || null;
      pages++;
    }
    console.log(`[importar_xml_outlook_compras] ${messages.length} emails (${pages} página(s))`);

    let total_xmls = 0, total_importados = 0, ja_existentes = 0, erros = 0;
    const detalhes: any[] = [];

    for (const msg of messages) {
      try {
        const attRes = await outlookFetch(`/me/messages/${msg.id}/attachments`);
        for (const att of (attRes.value || [])) {
          const name = (att.name || "").toLowerCase();
          if (!name.endsWith(".xml") || !att.contentBytes) continue;
          total_xmls++;

          let xml: string;
          try { xml = new TextDecoder("utf-8").decode(b64decode(att.contentBytes)); }
          catch { erros++; continue; }

          const nfe = parseNFe(xml);
          if (!nfe) { detalhes.push({ arquivo: att.name, status: "ignorado (não é NF-e)" }); continue; }

          // Ignora NF de vasilhame (retorno/remessa) — não afetam estoque de gás cheio nem geram pagamento
          const _nat = (nfe.natOp || "").toLowerCase();
          const _cfops = [nfe.cfopPred, ...nfe.itens.map(i => i.cfop)].filter(Boolean).map(c => c.replace(/\D/g, ""));
          const _vasilhameCfops = new Set(["1913","1914","2913","2914","5913","5914","6913","6914","5920","5921","6920","6921","1920","1921","2920","2921"]);
          const _isVasilhame = _cfops.some(c => _vasilhameCfops.has(c))
            || /vasilhame|botij[ãa]o vazio|comodato/i.test(_nat)
            || (/retorno|remessa/i.test(_nat) && !/venda|compra/i.test(_nat));
          if (_isVasilhame) {
            detalhes.push({ arquivo: att.name, nf: nfe.nNF, status: "ignorado (vasilhame/retorno/remessa)" });
            continue;
          }

          // antiduplicidade
          if (nfe.chave) {
            const { data: dup } = await supabase.from("compras")
              .select("id").eq("chave_nfe", nfe.chave).maybeSingle();
            if (dup) { ja_existentes++; detalhes.push({ arquivo: att.name, nf: nfe.nNF, status: "já existente" }); continue; }
          }

          // unidade pelo CNPJ destinatário
          const unidade_id = nfe.cnpjDest ? (cnpjToUnidade.get(nfe.cnpjDest) || null) : null;

          // fornecedor: localiza ou cria
          let fornecedor_id: string | null = null;
          if (nfe.cnpjEmit) {
            const existing = fornecedorByCnpj.get(nfe.cnpjEmit);
            if (existing) {
              fornecedor_id = existing.id;
            } else {
              const { data: novoForn, error: fErr } = await supabase.from("fornecedores").insert({
                empresa_id,
                razao_social: nfe.razaoEmit || "Fornecedor sem nome",
                nome_fantasia: nfe.fantasiaEmit || null,
                cnpj: fmtCnpj(nfe.cnpjEmit),
                endereco: nfe.enderEmit || null,
                cidade: nfe.cidadeEmit || null,
                estado: nfe.ufEmit || null,
                telefone: nfe.foneEmit || null,
                tipo: "fornecedor",
                ativo: true,
              }).select("id").single();
              if (fErr) console.warn("Erro criando fornecedor:", fErr.message);
              else {
                fornecedor_id = novoForn.id;
                fornecedorByCnpj.set(nfe.cnpjEmit, { id: novoForn.id, razao_social: nfe.razaoEmit });
              }
            }
          }

          // insere compra (cabeçalho + fiscal completo)
          const { data: compra, error: cErr } = await supabase.from("compras").insert({
            fornecedor_id,
            unidade_id,
            valor_total: nfe.vNF,
            valor_frete: nfe.vFrete || 0,
            numero_nota_fiscal: nfe.nNF || null,
            chave_nfe: nfe.chave,
            data_compra: nfe.data,
            data_prevista: nfe.data,
            data_pagamento: nfe.dVenc || null,
            observacoes: `Importado do Outlook · ${msg.subject || ""}`,
            status: "pendente",
            serie: nfe.serie || null,
            modelo: nfe.modelo || null,
            natureza_operacao: nfe.natOp || null,
            cfop_predominante: nfe.cfopPred || null,
            valor_produtos: nfe.vProd,
            valor_desconto: nfe.vDesc,
            valor_seguro: nfe.vSeg,
            valor_outros: nfe.vOutro,
            valor_icms: nfe.vICMS,
            valor_icms_st: nfe.vST,
            valor_ipi: nfe.vIPI,
            valor_pis: nfe.vPIS,
            valor_cofins: nfe.vCOFINS,
            base_icms: nfe.vBC,
            base_icms_st: nfe.vBCST,
            transportadora_nome: nfe.transpNome || null,
            transportadora_cnpj: nfe.transpCnpj || null,
            placa_veiculo: nfe.placa || null,
            modalidade_frete: nfe.modFrete || null,
            xml_content: nfe.xml,
          }).select("id").single();

          if (cErr) { erros++; detalhes.push({ arquivo: att.name, nf: nfe.nNF, status: "erro compra: " + cErr.message }); continue; }

          // produtos (busca por nome na unidade; cria se não existir com dados fiscais)
          const { data: produtos } = await supabase
            .from("produtos").select("id, nome, estoque, unidade_id")
            .eq("unidade_id", unidade_id || "");
          const findProduto = (nome: string) => {
            const n = nome.toLowerCase();
            return (produtos || []).find((p: any) =>
              p.nome.toLowerCase() === n ||
              p.nome.toLowerCase().includes(n) ||
              n.includes(p.nome.toLowerCase())
            );
          };

          const itensInsert: any[] = [];
          for (const item of nfe.itens) {
            let produto_id: string | null = null;
            const found = findProduto(item.xProd);
            if (found) {
              produto_id = (found as any).id;
            } else if (unidade_id) {
              const isMonofasico = (item.cst_pis === "04" || item.cst_cofins === "04" || (item.cProdANP || "").startsWith("21"));
              const isGas = /g[áa]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45/i.test(item.xProd);
              const fullPayload: any = {
                nome: item.xProd,
                preco: item.vUnCom,
                ativo: true,
                unidade_id,
                categoria: isGas ? "gas" : null,
                ncm: item.ncm || null,
                cest: item.cest || null,
                cfop_entrada_padrao: item.cfop || null,
                codigo_anp: item.cProdANP || null,
                cst_icms: item.cst_icms || null,
                csosn_icms: item.csosn_icms || null,
                cst_pis: item.cst_pis || null,
                cst_cofins: item.cst_cofins || null,
                aliquota_pis: item.aliquota_pis || null,
                aliquota_cofins: item.aliquota_cofins || null,
                unidade_tributavel: item.uCom || null,
                monofasico: isMonofasico,
              };
              let novoProd: any = null;
              let pErr: any = null;
              ({ data: novoProd, error: pErr } = await supabase.from("produtos").insert(fullPayload).select("id").single());
              if (pErr) {
                // fallback: tenta criar apenas com campos básicos para não perder o item
                console.warn("Erro criando produto com fiscal, tentando minimal:", pErr.message);
                const minimal = { nome: item.xProd, preco: item.vUnCom, ativo: true, unidade_id, categoria: isGas ? "gas" : null };
                const r = await supabase.from("produtos").insert(minimal).select("id").single();
                if (r.error) { console.warn("Erro criando produto minimal:", r.error.message); continue; }
                novoProd = r.data;
              }
              produto_id = novoProd.id;
            }
            if (!produto_id) continue;

            const qtd = Math.max(1, Math.round(item.qCom));
            itensInsert.push({
              compra_id: compra.id,
              produto_id,
              quantidade: qtd,
              preco_unitario: item.vUnCom,
              descricao_xml: item.xProd,
              codigo_produto_fornecedor: item.cProd || null,
              unidade_xml: item.uCom || null,
              ncm: item.ncm || null,
              cest: item.cest || null,
              cfop: item.cfop || null,
              codigo_anp: item.cProdANP || null,
              cst_icms: item.cst_icms || null,
              csosn_icms: item.csosn_icms || null,
              cst_pis: item.cst_pis || null,
              cst_cofins: item.cst_cofins || null,
              aliquota_icms: item.aliquota_icms || null,
              aliquota_pis: item.aliquota_pis || null,
              aliquota_cofins: item.aliquota_cofins || null,
              valor_icms: item.valor_icms || null,
              valor_pis: item.valor_pis || null,
              valor_cofins: item.valor_cofins || null,
              valor_desconto: item.vDesc || null,
            });
          }

          if (itensInsert.length) {
            const { error: iErr } = await supabase.from("compra_itens").insert(itensInsert);
            if (iErr) console.warn("Erro inserindo itens:", iErr.message);

            // baixa de estoque: incrementa produtos comprados
            for (const it of itensInsert) {
              const { data: prod } = await supabase.from("produtos")
                .select("estoque, unidade_id").eq("id", it.produto_id).single();
              if (prod) {
                await supabase.from("produtos")
                  .update({ estoque: (prod.estoque || 0) + it.quantidade })
                  .eq("id", it.produto_id);
                await supabase.from("movimentacoes_estoque").insert({
                  produto_id: it.produto_id,
                  tipo: "entrada",
                  quantidade: it.quantidade,
                  observacoes: `Compra NF ${nfe.nNF} (Outlook)`,
                  unidade_id: unidade_id || (prod as any).unidade_id || null,
                });
              }
            }
          }

          // conta a pagar quando há vencimento
          if (nfe.dVenc) {
            await supabase.from("contas_pagar").insert({
              descricao: `Compra NF ${nfe.nNF || "S/N"} - ${nfe.razaoEmit}`,
              fornecedor: nfe.razaoEmit,
              valor: nfe.vNF,
              vencimento: nfe.dVenc,
              categoria: "compras",
              unidade_id,
              status: "pendente",
            });
          }

          total_importados++;
          detalhes.push({ arquivo: att.name, nf: nfe.nNF, itens: itensInsert.length, status: "importado" });
        }
      } catch (e: any) {
        console.error("Erro msg", msg.id, e);
        erros++;
        detalhes.push({ msgId: msg.id, status: "erro: " + e.message });
      }
    }

    return new Response(JSON.stringify({
      ok: true, total_emails: messages.length, total_xmls,
      total_importados, ja_existentes, erros,
      detalhes: detalhes.slice(0, 50),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[importar_xml_outlook_compras] ERRO:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
