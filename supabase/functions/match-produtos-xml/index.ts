// Match XML NF items against existing products using Lovable AI.
// Receives lists of XML items + existing products (with fiscal fields)
// and returns, per item, the best matching produto_id or null.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";

interface XmlItem {
  index: number;
  xProd: string;
  cProd?: string;
  ncm?: string;
  cProdANP?: string;
  uCom?: string;
}
interface ExistingProduct {
  id: string;
  nome: string;
  ncm?: string | null;
  codigo_anp?: string | null;
  codigo_produto_fornecedor?: string | null;
}
interface MatchResult {
  index: number;
  match_produto_id: string | null;
  confianca: number;
  motivo: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "LOVABLE_API_KEY ausente", matches: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const xmlItems: XmlItem[] = Array.isArray(body?.xml_items) ? body.xml_items : [];
    const produtos: ExistingProduct[] = Array.isArray(body?.produtos) ? body.produtos : [];

    if (xmlItems.length === 0 || produtos.length === 0) {
      return new Response(JSON.stringify({ ok: true, matches: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `Você é um especialista em catálogo de produtos para distribuidoras de gás (GLP) e água mineral.
Sua tarefa: para cada ITEM da NF-e, identificar se ele já existe na lista de PRODUTOS cadastrados, mesmo que o nome esteja diferente.
Considere sinônimos comuns:
- "Gás P13" = "GLP 13kg" = "Botijão 13kg" = "P-13" = "P 13"
- "Gás P20" = "GLP 20kg" = "P-20"
- "Gás P45" = "GLP 45kg" = "P-45"
- "Água Mineral 20L" = "Galão 20L" = "Garrafão 20 litros"
Use NCM e código ANP como reforço. Se a confiança for baixa, retorne null.
Responda APENAS JSON válido no formato exato pedido.`;

    const user = `ITENS DA NF-e:
${JSON.stringify(xmlItems, null, 2)}

PRODUTOS CADASTRADOS:
${JSON.stringify(produtos, null, 2)}

Retorne JSON: { "matches": [ { "index": <int do item>, "match_produto_id": "<uuid ou null>", "confianca": <0..1>, "motivo": "<curto>" } ] }`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.warn("match-produtos-xml ai error:", resp.status, txt);
      return new Response(JSON.stringify({ ok: true, matches: [], warning: `AI ${resp.status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { matches?: MatchResult[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const matches = Array.isArray(parsed.matches) ? parsed.matches : [];

    return new Response(JSON.stringify({ ok: true, matches }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("match-produtos-xml erro:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message, matches: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
