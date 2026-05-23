// Reprocessa data_emissao das notas_fiscais relendo o XML do bucket contabil-xmls.
// Corrige registros importados com shift de fuso (ex: 31/03 23:15-03 virando 01/04).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { empresa_id, dry_run = false } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase.from("notas_fiscais")
      .select("id, xml_url, data_emissao, unidade_id, numero")
      .not("xml_url", "is", null)
      .limit(2000);

    if (empresa_id) {
      const { data: unids } = await supabase.from("unidades").select("id").eq("empresa_id", empresa_id);
      const ids = (unids ?? []).map((u: any) => u.id);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ ok: true, total: 0, atualizados: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      q = q.in("unidade_id", ids);
    }

    const { data: notas, error } = await q;
    if (error) throw error;

    const get = (xml: string, tag: string) => {
      const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : null;
    };

    let atualizados = 0;
    let inalterados = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const n of notas ?? []) {
      try {
        const { data: file, error: dlErr } = await supabase.storage
          .from("contabil-xmls").download(n.xml_url);
        if (dlErr || !file) { erros++; continue; }
        const xml = await file.text();
        const dhEmi = get(xml, "dhEmi");
        const dEmi = get(xml, "dEmi");
        const novaData = dhEmi ? dhEmi.slice(0, 10) : (dEmi ? dEmi.slice(0, 10) : null);
        if (!novaData) { inalterados++; continue; }
        const atual = (n.data_emissao ?? "").slice(0, 10);
        if (atual === novaData) { inalterados++; continue; }
        if (!dry_run) {
          const { error: upErr } = await supabase.from("notas_fiscais")
            .update({ data_emissao: novaData }).eq("id", n.id);
          if (upErr) { erros++; continue; }
        }
        atualizados++;
        if (detalhes.length < 50) detalhes.push({ id: n.id, numero: n.numero, de: atual, para: novaData });
      } catch (_) { erros++; }
    }

    return new Response(JSON.stringify({
      ok: true, total: notas?.length ?? 0, atualizados, inalterados, erros, dry_run, detalhes,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
