import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { xml, filename, empresa_id, unidade_id } = await req.json();
    if (!xml || !empresa_id || !unidade_id) {
      return new Response(JSON.stringify({ error: "xml, empresa_id, unidade_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const get = (tag: string) => {
      const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : null;
    };

    let tipo = "nfe";
    if (/<NFe[\s>]/i.test(xml) && /modelo>65</i.test(xml)) tipo = "nfce";
    else if (/<CTe[\s>]/i.test(xml)) tipo = "cte";
    else if (/<MDFe[\s>]/i.test(xml)) tipo = "mdfe";

    const chave = (xml.match(/Id="NFe(\d{44})"/i) || xml.match(/Id="CTe(\d{44})"/i) || xml.match(/Id="MDFe(\d{44})"/i) || [])[1]
      || get("chNFe") || get("chCTe") || null;
    const numero = get("nNF") || get("nCT") || get("nMDF");
    const serie = get("serie");
    const valor_total = parseFloat(get("vNF") || get("vTPrest") || get("vBC") || "0") || 0;
    // A coluna data_emissao é DATE no banco. Para evitar shift de fuso ao fazer cast
    // (ex: "2026-03-31T23:15:00-03:00" cast em UTC vira 2026-04-01), extraímos
    // o dia LOCAL do emitente direto do próprio XML, preservando o offset original.
    const dhEmi = get("dhEmi"); // "2026-03-31T23:15:00-03:00"
    const dEmi = get("dEmi");   // "2026-03-31"
    let data_emissao: string | null = null;
    if (dhEmi) {
      // Pega apenas os 10 primeiros chars (YYYY-MM-DD) — esta é a data LOCAL do XML
      data_emissao = dhEmi.slice(0, 10);
    } else if (dEmi) {
      data_emissao = dEmi.slice(0, 10);
    }
    const remetente_nome = get("xNome");
    const remetente_cnpj = get("CNPJ");

    // Anti-duplicidade
    if (chave) {
      const { data: existing } = await supabase.from("notas_fiscais")
        .select("id").eq("chave_acesso", chave).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ duplicate: true, id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Upload XML
    const path = `${empresa_id}/${unidade_id}/${chave ?? `nf-${Date.now()}`}.xml`;
    const { error: upErr } = await supabase.storage.from("contabil-xmls")
      .upload(path, new Blob([xml], { type: "application/xml" }), { upsert: false });
    if (upErr && !upErr.message.includes("already exists")) console.warn("upload xml:", upErr);

    const insertData: any = {
      chave_acesso: chave,
      numero,
      serie,
      tipo,
      valor_total,
      data_emissao: data_emissao,
      remetente_nome,
      remetente_cnpj,
      xml_url: path,
      status: "importado",
      unidade_id,
    };

    const { data: inserted, error } = await supabase.from("notas_fiscais")
      .insert(insertData).select("id").single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: inserted.id, tipo, numero }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-nfe-xml:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
