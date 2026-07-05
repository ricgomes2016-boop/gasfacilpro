// Edge function: lookup-barcode
// Busca dados de um produto a partir do código de barras (EAN/GTIN)
// usando Open Food Facts (gratuito, sem key) e, opcionalmente, Cosmos Bluesoft.
// Sempre retorna 200 OK com { ok, encontrado, dados, fonte }.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";

interface Dados {
  nome: string | null;
  descricao: string | null;
  marca: string | null;
  categoria_sugerida: "gas" | "agua" | "acessorio" | "outro" | null;
  imagem_url: string | null;
}

function sugerirCategoria(texto: string): Dados["categoria_sugerida"] {
  const t = texto.toLowerCase();
  if (/\bgas\b|\bglp\b|botij[aã]o|p\s?13|p\s?20|p\s?45/.test(t)) return "gas";
  if (/[áa]gua|mineral|gal[aã]o|garraf[aã]o|20\s?l\b/.test(t)) return "agua";
  if (/mangueira|regulador|v[aá]lvula|adaptador/.test(t)) return "acessorio";
  return "outro";
}

async function tentarOpenFoodFacts(codigo: string): Promise<Dados | null> {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.status !== 1 || !j.product) return null;
    const p = j.product;
    const nome = p.product_name_pt || p.product_name || p.generic_name_pt || p.generic_name || null;
    if (!nome) return null;
    const marca = p.brands || null;
    const descricao = [p.generic_name_pt || p.generic_name, p.quantity].filter(Boolean).join(" - ") || null;
    return {
      nome,
      descricao,
      marca,
      categoria_sugerida: sugerirCategoria(`${nome} ${descricao ?? ""} ${marca ?? ""}`),
      imagem_url: p.image_front_url || p.image_url || null,
    };
  } catch (e) {
    console.warn("OFF erro:", e);
    return null;
  }
}

async function tentarCosmos(codigo: string, token: string): Promise<Dados | null> {
  try {
    const r = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${codigo}.json`, {
      headers: { "X-Cosmos-Token": token, "User-Agent": "Cosmos-API-Request" },
    });
    if (!r.ok) return null;
    const p = await r.json();
    const nome = p?.description || p?.gpc?.description || null;
    if (!nome) return null;
    const marca = p?.brand?.name || null;
    const descricao = p?.gpc?.description || null;
    return {
      nome,
      descricao,
      marca,
      categoria_sugerida: sugerirCategoria(`${nome} ${descricao ?? ""} ${marca ?? ""}`),
      imagem_url: p?.thumbnail || null,
    };
  } catch (e) {
    console.warn("Cosmos erro:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const { codigo } = await req.json().catch(() => ({ codigo: "" }));
    const ean = String(codigo || "").replace(/\D/g, "");

    if (ean.length < 8 || ean.length > 14) {
      return new Response(
        JSON.stringify({ ok: true, encontrado: false, motivo: "EAN inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let dados = await tentarOpenFoodFacts(ean);
    let fonte: string | null = dados ? "Open Food Facts" : null;

    if (!dados) {
      const cosmosToken = Deno.env.get("COSMOS_BLUESOFT_TOKEN");
      if (cosmosToken) {
        dados = await tentarCosmos(ean, cosmosToken);
        if (dados) fonte = "Cosmos Bluesoft";
      }
    }

    return new Response(
      JSON.stringify({ ok: true, encontrado: !!dados, dados, fonte }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("lookup-barcode erro:", err);
    return new Response(
      JSON.stringify({ ok: true, encontrado: false, error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
