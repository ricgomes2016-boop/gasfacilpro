import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

// Extrai um campo simples de XML: <tag>valor</tag>
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

// Decodifica base64 robusto
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

interface ParsedNFe {
  chave_nfe: string | null;
  numero_nf: string | null;
  data: string | null;
  fornecedor: string | null;
  cidade_fornecedor: string | null;
  itens: {
    produto: string;
    cfop: string | null;
    quantidade: number;
    preco_unitario: number;
    valor_total: number;
  }[];
  valor_total_nota: number;
}

function parseNFeXml(xml: string): ParsedNFe | null {
  // Chave de acesso: vem como atributo Id="NFe44170..."
  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chave_nfe = chaveMatch ? chaveMatch[1] : null;

  const numero_nf = pick(xml, "nNF");
  const dhEmi = pick(xml, "dhEmi") || pick(xml, "dEmi");
  const data = dhEmi ? dhEmi.slice(0, 10) : null;

  // Bloco emit
  const emitMatch = xml.match(/<emit[^>]*>([\s\S]*?)<\/emit>/i);
  const emitXml = emitMatch ? emitMatch[1] : "";
  const fornecedor = pick(emitXml, "xNome");
  const cidade_fornecedor = pick(emitXml, "xMun");

  // Itens: cada <det>
  const itens: ParsedNFe["itens"] = [];
  const detBlocks = pickAll(xml, "det");
  for (const det of detBlocks) {
    const prodMatch = det.match(/<prod[^>]*>([\s\S]*?)<\/prod>/i);
    if (!prodMatch) continue;
    const prod = prodMatch[1];
    itens.push({
      produto: pick(prod, "xProd") || "",
      cfop: pick(prod, "CFOP"),
      quantidade: parseFloat(pick(prod, "qCom") || "0"),
      preco_unitario: parseFloat(pick(prod, "vUnCom") || "0"),
      valor_total: parseFloat(pick(prod, "vProd") || "0"),
    });
  }

  const totalMatch = xml.match(/<ICMSTot[^>]*>([\s\S]*?)<\/ICMSTot>/i);
  const totalXml = totalMatch ? totalMatch[1] : "";
  const valor_total_nota = parseFloat(pick(totalXml, "vNF") || "0");

  if (!numero_nf && !chave_nfe) return null;

  return { chave_nfe, numero_nf, data, fornecedor, cidade_fornecedor, itens, valor_total_nota };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Cliente como usuário (para identificar empresa)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente service-role para inserts ignorando RLS
    const supabase = createClient(supabaseUrl, serviceKey);

    // Pega empresa do usuário
    const { data: profile } = await supabase
      .from("profiles").select("empresa_id").eq("user_id", user.id).single();
    const empresa_id = profile?.empresa_id;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Usuário sem empresa associada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dias = Math.min(Math.max(parseInt(body.dias ?? "30"), 1), 180);
    const filtroRemetente: string | null = body.filtro_remetente || null;

    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    // Monta filtro OData
    const filterParts = [
      "hasAttachments eq true",
      `receivedDateTime ge ${desde}`,
    ];
    if (filtroRemetente) {
      filterParts.push(`from/emailAddress/address eq '${filtroRemetente}'`);
    }
    const filter = encodeURIComponent(filterParts.join(" and "));
    const select = encodeURIComponent("id,subject,from,receivedDateTime,hasAttachments");

    console.log(`[importar_xml_outlook] Buscando emails desde ${desde}, filtro: ${filtroRemetente || "(todos)"}`);
    const list = await outlookFetch(`/me/messages?$filter=${filter}&$select=${select}&$top=50&$orderby=receivedDateTime desc`);
    const messages = list.value || [];
    console.log(`[importar_xml_outlook] ${messages.length} emails com anexos encontrados`);

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

          // Só processa NF-e
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

          for (const item of nfe.itens) {
            // Verifica duplicidade pela chave única
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

            // Detecta produto P13/P20/P45/Água
            const desc = item.produto.toLowerCase();
            const qtd_p13 = /p[\s-]?13|13\s*kg/.test(desc) ? item.quantidade : 0;
            const qtd_p20 = /p[\s-]?20|20\s*kg/.test(desc) ? item.quantidade : 0;
            const qtd_p45 = /p[\s-]?45|45\s*kg/.test(desc) ? item.quantidade : 0;
            const qtd_agua = /[áa]gua|gal[ãa]o/.test(desc) ? item.quantidade : 0;

            const { error: insErr } = await supabase.from("transp_compras").insert({
              empresa_id,
              data: nfe.data || new Date().toISOString().slice(0, 10),
              fornecedor: nfe.fornecedor || "Desconhecido",
              cidade_fornecedor: nfe.cidade_fornecedor,
              chave_nfe: nfe.chave_nfe,
              numero_nf: nfe.numero_nf,
              outlook_message_id: msg.id,
              produto_descricao: item.produto,
              cfop: item.cfop,
              qtd_p13, qtd_p20, qtd_p45, qtd_agua,
              valor_compra: item.valor_total,
              custo_total: item.valor_total,
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
              detalhes.push({ arquivo: att.name, nf: nfe.numero_nf, produto: item.produto, status: "importado" });
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
