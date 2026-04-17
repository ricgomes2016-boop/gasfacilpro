import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

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

function b64decode(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

// Classifica produto em cheio | vasilhame | outros baseado em CFOP + descrição
function classificarTipo(cfop: string | null, descricao: string): "cheio" | "vasilhame" | "outros" {
  const desc = descricao.toLowerCase();
  // Vasilhame primeiro (palavras explícitas)
  if (/vasilhame|vazio|botij[aã]o\s+vazio|sem\s+carga/.test(desc)) return "vasilhame";
  // CFOPs típicos de venda de mercadoria (cheio): 5101, 5102, 5103, 5403, 5405, 5656, 6101, 6102, 6403, 6404
  const cfopCheio = ["5101","5102","5103","5104","5405","5403","5656","6101","6102","6103","6403","6404","5651","5652","6651","6652"];
  // CFOPs de remessa/retorno de vasilhame: 5949, 5556, 5920, 5921, 6949
  const cfopVasilhame = ["5556","5920","5921","6920","6921"];
  if (cfop && cfopVasilhame.includes(cfop)) return "vasilhame";
  if (cfop && cfopCheio.includes(cfop)) {
    if (/g[aá]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45|13\s*kg|20\s*kg|45\s*kg/.test(desc)) return "cheio";
  }
  // Fallback por descrição
  if (/g[aá]s|glp|p[\s-]?13|p[\s-]?20|p[\s-]?45|13\s*kg|20\s*kg|45\s*kg/.test(desc)) return "cheio";
  if (/[áa]gua|gal[ãa]o/.test(desc)) return "outros";
  return "outros";
}

interface ParsedItem {
  produto: string;
  cfop: string | null;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  desconto: number;
  tipo: "cheio" | "vasilhame" | "outros";
}

interface ParsedNFe {
  chave_nfe: string | null;
  numero_nf: string | null;
  data: string | null;
  fornecedor: string | null;
  cidade_fornecedor: string | null;
  cnpj_destinatario: string | null;
  data_vencimento: string | null;
  desconto_total: number;
  itens: ParsedItem[];
  valor_total_nota: number;
}

function parseNFeXml(xml: string): ParsedNFe | null {
  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chave_nfe = chaveMatch ? chaveMatch[1] : null;

  const numero_nf = pick(xml, "nNF");
  const dhEmi = pick(xml, "dhEmi") || pick(xml, "dEmi");
  const data = dhEmi ? dhEmi.slice(0, 10) : null;

  // emit (fornecedor)
  const emitMatch = xml.match(/<emit[^>]*>([\s\S]*?)<\/emit>/i);
  const emitXml = emitMatch ? emitMatch[1] : "";
  const fornecedor = pick(emitXml, "xNome");
  const cidade_fornecedor = pick(emitXml, "xMun");

  // dest (filial destinatária)
  const destMatch = xml.match(/<dest[^>]*>([\s\S]*?)<\/dest>/i);
  const destXml = destMatch ? destMatch[1] : "";
  const cnpj_destinatario = pick(destXml, "CNPJ") || pick(destXml, "CPF");

  // duplicatas (vencimento) — pega a primeira
  const dupMatch = xml.match(/<dup[^>]*>([\s\S]*?)<\/dup>/i);
  const dupXml = dupMatch ? dupMatch[1] : "";
  const data_vencimento = pick(dupXml, "dVenc");

  // Itens
  const itens: ParsedItem[] = [];
  const detBlocks = pickAll(xml, "det");
  for (const det of detBlocks) {
    const prodMatch = det.match(/<prod[^>]*>([\s\S]*?)<\/prod>/i);
    if (!prodMatch) continue;
    const prod = prodMatch[1];
    const produto = pick(prod, "xProd") || "";
    const cfop = pick(prod, "CFOP");
    const desconto = parseFloat(pick(prod, "vDesc") || "0");
    itens.push({
      produto,
      cfop,
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
  const desconto_total = parseFloat(pick(totalXml, "vDesc") || "0");

  if (!numero_nf && !chave_nfe) return null;

  return {
    chave_nfe, numero_nf, data, fornecedor, cidade_fornecedor,
    cnpj_destinatario, data_vencimento, desconto_total,
    itens, valor_total_nota,
  };
}

async function outlookFetch(path: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OUTLOOK_KEY = Deno.env.get("MICROSOFT_OUTLOOK_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!OUTLOOK_KEY) throw new Error("MICROSOFT_OUTLOOK_API_KEY não configurada — conecte o Outlook");

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": OUTLOOK_KEY,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Outlook API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

function normalizeCnpj(s: string | null): string {
  return (s || "").replace(/\D/g, "");
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

    // Carrega unidades (filiais) da empresa para mapear CNPJ → unidade_id
    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, cnpj")
      .eq("empresa_id", empresa_id);
    const cnpjToUnidade = new Map<string, string>();
    for (const u of (unidades || [])) {
      const c = normalizeCnpj((u as any).cnpj);
      if (c) cnpjToUnidade.set(c, u.id);
    }

    const body = await req.json().catch(() => ({}));
    const dias = Math.min(Math.max(parseInt(body.dias ?? "30"), 1), 180);
    const filtroRemetente: string | null = body.filtro_remetente || null;

    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const filterParts = [`receivedDateTime ge ${desde}`];
    if (filtroRemetente) {
      filterParts.push(`from/emailAddress/address eq '${filtroRemetente}'`);
    }
    const filter = encodeURIComponent(filterParts.join(" and "));
    const select = encodeURIComponent("id,subject,from,receivedDateTime,hasAttachments");

    console.log(`[importar_xml_outlook] Buscando emails desde ${desde}, filtro: ${filtroRemetente || "(todos)"}`);
    const list = await outlookFetch(`/me/messages?$filter=${filter}&$select=${select}&$top=100`);
    const messages = (list.value || []).filter((m: any) => m.hasAttachments === true);
    console.log(`[importar_xml_outlook] ${messages.length} emails com anexos`);

    let total_xmls = 0;
    let total_importados = 0;
    let ja_existentes = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const msg of messages) {
      try {
        const attRes = await outlookFetch(`/me/messages/${msg.id}/attachments`);
        const atts = attRes.value || [];
        for (const att of atts) {
          const name = (att.name || "").toLowerCase();
          if (!name.endsWith(".xml")) continue;
          if (!att.contentBytes) continue;
          total_xmls++;

          let xml: string;
          try {
            xml = bytesToString(b64decode(att.contentBytes));
          } catch (e) {
            console.error("Falha decode base64", att.name, e);
            erros++;
            continue;
          }

          if (!/<infNFe/i.test(xml)) {
            detalhes.push({ arquivo: att.name, status: "ignorado (não é NF-e)" });
            continue;
          }

          const nfe = parseNFeXml(xml);
          if (!nfe) {
            erros++;
            detalhes.push({ arquivo: att.name, status: "erro parse" });
            continue;
          }

          const cnpjDest = normalizeCnpj(nfe.cnpj_destinatario);
          const unidade_id = cnpjDest ? (cnpjToUnidade.get(cnpjDest) || null) : null;

          for (const item of nfe.itens) {
            const { data: existing } = await supabase
              .from("transp_compras")
              .select("id")
              .eq("empresa_id", empresa_id)
              .eq("chave_nfe", nfe.chave_nfe || "")
              .eq("produto_descricao", item.produto)
              .maybeSingle();

            if (existing) {
              ja_existentes++;
              continue;
            }

            // Quantidades P13/P20/P45/Água — apenas quando tipo = cheio
            const desc = item.produto.toLowerCase();
            const isCheio = item.tipo === "cheio";
            const qtd_p13 = isCheio && /p[\s-]?13|13\s*kg/.test(desc) ? item.quantidade : 0;
            const qtd_p20 = isCheio && /p[\s-]?20|20\s*kg/.test(desc) ? item.quantidade : 0;
            const qtd_p45 = isCheio && /p[\s-]?45|45\s*kg/.test(desc) ? item.quantidade : 0;
            const qtd_agua = /[áa]gua|gal[ãa]o/.test(desc) ? item.quantidade : 0;

            const valorLiquido = item.valor_total - item.desconto;

            const { error: insErr } = await supabase.from("transp_compras").insert({
              empresa_id,
              unidade_id,
              cnpj_destinatario: cnpjDest || null,
              data: nfe.data || new Date().toISOString().slice(0, 10),
              data_vencimento: nfe.data_vencimento || null,
              fornecedor: nfe.fornecedor || "Desconhecido",
              cidade_fornecedor: nfe.cidade_fornecedor,
              chave_nfe: nfe.chave_nfe,
              numero_nf: nfe.numero_nf,
              outlook_message_id: msg.id,
              produto_descricao: item.produto,
              cfop: item.cfop,
              tipo_produto: item.tipo,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              desconto: item.desconto,
              qtd_p13, qtd_p20, qtd_p45, qtd_agua,
              valor_compra: valorLiquido,
              custo_total: valorLiquido,
              custo_logistico_total: 0,
              custo_combustivel: 0,
              custo_pedagio: 0,
              custo_refeicao: 0,
              custo_outros: 0,
              custo_unit_p13: qtd_p13 > 0 ? item.preco_unitario : 0,
              custo_unit_p20: qtd_p20 > 0 ? item.preco_unitario : 0,
              custo_unit_p45: qtd_p45 > 0 ? item.preco_unitario : 0,
              custo_unit_agua: qtd_agua > 0 ? item.preco_unitario : 0,
              distancia_ida_km: 0,
              mes_referencia: (nfe.data || new Date().toISOString().slice(0, 10)).slice(0, 7),
              observacoes: `Importado do Outlook · NF ${nfe.numero_nf} · ${msg.subject || ""}`,
            });

            if (insErr) {
              console.error("Erro insert", insErr);
              erros++;
              detalhes.push({ arquivo: att.name, nf: nfe.numero_nf, status: "erro insert: " + insErr.message });
            } else {
              total_importados++;
              detalhes.push({
                arquivo: att.name, nf: nfe.numero_nf, produto: item.produto,
                tipo: item.tipo, unidade_id, status: "importado",
              });
            }
          }
        }
      } catch (e: any) {
        console.error("Erro processando msg", msg.id, e);
        erros++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      total_emails: messages.length,
      total_xmls,
      total_importados,
      ja_existentes,
      erros,
      detalhes: detalhes.slice(0, 50),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[importar_xml_outlook] ERRO:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
