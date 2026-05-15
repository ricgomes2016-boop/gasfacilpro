// Consulta pública na ANP - Revenda de GLP
// Site: https://app.anp.gov.br/anp-cpl-web/public/glp/consulta/index.xhtml
// Estratégia: a ANP expõe um endpoint público de consulta JSON pelo CNPJ.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body {
  cnpj: string;
  unidade_id: string;
  empresa_id: string;
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

async function consultarANP(cnpj: string) {
  const cnpjClean = onlyDigits(cnpj);
  if (cnpjClean.length !== 14) {
    return { ok: false, error: "CNPJ inválido" };
  }

  // A ANP disponibiliza consulta pública. Tentamos o endpoint de busca por CNPJ.
  // URL pública que retorna HTML com os dados da revenda
  const url = `https://app.anp.gov.br/anp-cpl-web/public/glp/consulta/consultar.xhtml?cnpj=${cnpjClean}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GasFacilPro/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const html = await resp.text();

    if (!resp.ok) {
      return { ok: false, error: `ANP retornou HTTP ${resp.status}` };
    }

    // Heurística: procurar razão social, autorização e vigência no HTML
    const razaoMatch = html.match(/Raz[aã]o\s+Social[^<]*<[^>]+>\s*([^<]+)/i);
    const autorMatch = html.match(/Autoriza[cç][aã]o[^<]*<[^>]+>\s*([^<]+)/i);
    const vigenciaMatch = html.match(/(\d{2}\/\d{2}\/\d{4})/g);
    const situacaoMatch = html.match(/Situa[cç][aã]o[^<]*<[^>]+>\s*([^<]+)/i);

    const razao = razaoMatch?.[1]?.trim();
    const autorizacao = autorMatch?.[1]?.trim();
    const situacao = situacaoMatch?.[1]?.trim();

    if (!razao && !autorizacao) {
      return {
        ok: false,
        error: "Revenda de GLP não encontrada na ANP para este CNPJ. Verifique no portal oficial.",
        url_oficial: `https://app.anp.gov.br/anp-cpl-web/public/glp/consulta/index.xhtml`,
      };
    }

    // Vigência: pegar última data como vencimento estimado
    const datas = vigenciaMatch || [];
    const vencimento = datas.length > 0 ? datas[datas.length - 1] : null;

    return {
      ok: true,
      razao_social: razao,
      autorizacao,
      situacao,
      vencimento_str: vencimento,
      url_oficial: url,
    };
  } catch (e) {
    return { ok: false, error: `Erro ao acessar ANP: ${(e as Error).message}` };
  }
}

function brToISO(d?: string | null): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { cnpj, unidade_id, empresa_id } = (await req.json()) as Body;

    if (!cnpj || !unidade_id || !empresa_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cnpj, unidade_id e empresa_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await consultarANP(cnpj);

    // Salva no banco
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const vencISO = brToISO(result.ok ? result.vencimento_str : null);
    const status = !result.ok
      ? "erro"
      : vencISO && new Date(vencISO) < new Date()
      ? "vencida"
      : "regular";

    await supabase.from("certidoes_empresa").upsert(
      {
        empresa_id,
        unidade_id,
        tipo: "anp",
        numero: result.ok ? result.autorizacao : null,
        data_vencimento: vencISO,
        status,
        origem: "automatica",
        dados_json: result,
        ultima_consulta_at: new Date().toISOString(),
        ultimo_erro: result.ok ? null : result.error,
      },
      { onConflict: "unidade_id,tipo" },
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
