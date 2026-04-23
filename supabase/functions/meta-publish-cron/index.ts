import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cron: roda a cada 5 minutos. Publica agendamentos vencidos cujas contas estão via OAuth.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const { data: agendamentos, error } = await supabase
      .from("marketing_agendamentos")
      .select("*, social_accounts!inner(*)")
      .eq("status", "agendado")
      .lte("data_agendada", now)
      .eq("social_accounts.conectado_via", "oauth")
      .limit(20);

    if (error) throw error;

    const results: Array<{ id: string; ok: boolean; msg?: string }> = [];

    for (const ag of agendamentos ?? []) {
      try {
        const publishUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-publish-post`;
        const res = await fetch(publishUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            social_account_id: ag.social_account_id,
            image_url: ag.imagem_url,
            caption: `${ag.legenda ?? ""}\n\n${ag.hashtags ?? ""}`.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "publish failed");

        await supabase
          .from("marketing_agendamentos")
          .update({
            status: "publicado",
            publicado_em: new Date().toISOString(),
            external_post_id: data.external_id,
          })
          .eq("id", ag.id);

        results.push({ id: ag.id, ok: true });
      } catch (e) {
        await supabase
          .from("marketing_agendamentos")
          .update({
            status: "erro",
            erro_mensagem: String((e as Error).message ?? e).slice(0, 500),
          })
          .eq("id", ag.id);
        results.push({ id: ag.id, ok: false, msg: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meta-publish-cron error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
