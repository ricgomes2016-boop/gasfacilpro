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
  return "outros";
}

async function outlookFetch(path: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OUTLOOK_KEY = Deno.env.get("MICROSOFT_OUTLOOK_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!OUTLOOK_KEY) throw new Error("MICROSOFT_OUTLOOK_API_KEY não configurada");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": OUTLOOK_KEY,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Outlook API ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

interface ParsedMatch {
  cnpj_destinatario: string | null;
  data_vencimento: string | null;
  itens: Array<{
    produto: string;
    cfop: string | null;
    quantidade: number;
    preco_unitario: number;
    valor_total: number;
    desconto: number;
    tipo: "cheio" | "vasilhame" | "outros";
  }>;
}

function parseNFe(xml: string): ParsedMatch | null {
  if (!/<infNFe/i.test(xml)) return null;
  const destMatch = xml.match(/<dest[^>]*>([\s\S]*?)<\/dest>/i);
  const destXml = destMatch ? destMatch[1] : "";
  const cnpj_destinatario = pick(destXml, "CNPJ") || pick(destXml, "CPF");
  const dupMatch = xml.match(/<dup[^>]*>([\s\S]*?)<\/dup>/i);
  const dupXml = dupMatch ? dupMatch[1] : "";
  const data_vencimento = pick(dupXml, "dVenc");
  const itens: ParsedMatch["itens"] = [];
  for (const det of pickAll(xml, "det")) {
    const prodMatch = det.match(/<prod[^>]*>([\s\S]*?)<\/prod>/i);
    if (!prodMatch) continue;
    const prod = prodMatch[1];
    const produto = pick(prod, "xProd") || "";
    const cfop = pick(prod, "CFOP");
    itens.push({
      produto,
      cfop,
      quantidade: parseFloat(pick(prod, "qCom") || "0"),
      preco_unitario: parseFloat(pick(prod, "vUnCom") || "0"),
      valor_total: parseFloat(pick(prod, "vProd") || "0"),
      desconto: parseFloat(pick(prod, "vDesc") || "0"),
      tipo: classificarTipo(cfop, produto),
    });
  }
  return { cnpj_destinatario, data_vencimento, itens };
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
      return new Response(JSON.stringify({ error: "Sem empresa" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mes_referencia: string = body.mes_referencia || new Date().toISOString().slice(0, 7);

    // Mapa CNPJ → unidade_id
    const { data: unidades } = await supabase
      .from("unidades").select("id, cnpj").eq("empresa_id", empresa_id);
    const cnpjToUnidade = new Map<string, string>();
    for (const u of (unidades || [])) {
      const c = normalizeCnpj((u as any).cnpj);
      if (c) cnpjToUnidade.set(c, u.id);
    }

    // Busca compras do mês com outlook_message_id e sem tipo_produto preenchido
    const { data: compras, error: cErr } = await supabase
      .from("transp_compras")
      .select("id, outlook_message_id, produto_descricao, chave_nfe")
      .eq("empresa_id", empresa_id)
      .eq("mes_referencia", mes_referencia)
      .not("outlook_message_id", "is", null);
    if (cErr) throw cErr;

    console.log(`[reprocessar] ${compras?.length || 0} compras para reprocessar (mes=${mes_referencia})`);

    // Agrupa por message_id (1 email pode ter vários itens)
    const porMsg = new Map<string, typeof compras>();
    for (const c of (compras || [])) {
      const arr = porMsg.get(c.outlook_message_id!) || [];
      arr.push(c);
      porMsg.set(c.outlook_message_id!, arr);
    }

    let atualizados = 0;
    let nao_encontrados = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const [msgId, itensCompra] of porMsg.entries()) {
      try {
        const attRes = await outlookFetch(`/me/messages/${msgId}/attachments`);
        const atts = attRes.value || [];
        let parsed: ParsedMatch | null = null;
        for (const att of atts) {
          const name = (att.name || "").toLowerCase();
          if (!name.endsWith(".xml") || !att.contentBytes) continue;
          try {
            const xml = bytesToString(b64decode(att.contentBytes));
            const p = parseNFe(xml);
            if (p && p.itens.length > 0) { parsed = p; break; }
          } catch (_) { /* tenta próximo anexo */ }
        }
        if (!parsed) {
          nao_encontrados += itensCompra.length;
          detalhes.push({ msgId, status: "xml não encontrado/parse falhou" });
          continue;
        }

        const cnpjDest = normalizeCnpj(parsed.cnpj_destinatario);
        const unidade_id = cnpjDest ? (cnpjToUnidade.get(cnpjDest) || null) : null;

        for (const compra of itensCompra) {
          // Match por descrição do produto
          const item = parsed.itens.find((i) => i.produto === compra.produto_descricao)
            || parsed.itens.find((i) => i.produto.toLowerCase() === (compra.produto_descricao || "").toLowerCase());
          if (!item) {
            nao_encontrados++;
            detalhes.push({ id: compra.id, produto: compra.produto_descricao, status: "item não bateu" });
            continue;
          }

          const desc = item.produto.toLowerCase();
          const isCheio = item.tipo === "cheio";
          const qtd_p13 = isCheio && /p[\s-]?13|13\s*kg/.test(desc) ? item.quantidade : 0;
          const qtd_p20 = isCheio && /p[\s-]?20|20\s*kg/.test(desc) ? item.quantidade : 0;
          const qtd_p45 = isCheio && /p[\s-]?45|45\s*kg/.test(desc) ? item.quantidade : 0;
          const qtd_agua = /[áa]gua|gal[ãa]o/.test(desc) ? item.quantidade : 0;
          const valorLiquido = item.valor_total - item.desconto;

          const { error: upErr } = await supabase
            .from("transp_compras")
            .update({
              unidade_id,
              cnpj_destinatario: cnpjDest || null,
              data_vencimento: parsed.data_vencimento || null,
              cfop: item.cfop,
              tipo_produto: item.tipo,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              desconto: item.desconto,
              qtd_p13, qtd_p20, qtd_p45, qtd_agua,
              valor_compra: valorLiquido,
              custo_total: valorLiquido,
              custo_unit_p13: qtd_p13 > 0 ? item.preco_unitario : 0,
              custo_unit_p20: qtd_p20 > 0 ? item.preco_unitario : 0,
              custo_unit_p45: qtd_p45 > 0 ? item.preco_unitario : 0,
              custo_unit_agua: qtd_agua > 0 ? item.preco_unitario : 0,
            })
            .eq("id", compra.id);
          if (upErr) {
            erros++;
            detalhes.push({ id: compra.id, status: "erro update: " + upErr.message });
          } else {
            atualizados++;
          }
        }
      } catch (e: any) {
        console.error("Erro msg", msgId, e);
        erros += itensCompra.length;
        detalhes.push({ msgId, status: "erro: " + e.message });
      }
    }

    return new Response(JSON.stringify({
      ok: true, mes_referencia,
      total_compras: compras?.length || 0,
      total_emails: porMsg.size,
      atualizados, nao_encontrados, erros,
      detalhes: detalhes.slice(0, 30),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[reprocessar_xml_outlook] ERRO:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
