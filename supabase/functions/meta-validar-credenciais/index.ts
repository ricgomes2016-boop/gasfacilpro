// Validates Meta WhatsApp credentials WITHOUT touching the DB.
// Body: { access_token, phone_number_id?, waba_id? }
// Returns step-by-step diagnostic from Graph API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v21.0";

interface StepResult {
  step: string;
  status: "ok" | "erro" | "skip";
  message: string;
  data?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const access_token = (body.access_token || "").trim();
    const phone_number_id = (body.phone_number_id || "").trim();
    const waba_id = (body.waba_id || "").trim();

    if (!access_token) {
      return new Response(
        JSON.stringify({ ok: false, error: "access_token obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: StepResult[] = [];
    let token_info: any = null;
    let phone_info: any = null;
    let waba_info: any = null;

    // 1) Token / debug_token
    try {
      const r = await fetch(`${META_API}/debug_token?input_token=${access_token}&access_token=${access_token}`);
      const d = await r.json();
      const info = d?.data;
      if (r.ok && info?.is_valid) {
        token_info = info;
        const exp = info.expires_at === 0 ? "permanente" : new Date(info.expires_at * 1000).toLocaleString("pt-BR");
        results.push({
          step: "token",
          status: "ok",
          message: `Token válido — App: ${info.application || "N/A"} (${info.app_id}), tipo: ${info.type}, expira: ${exp}`,
          data: info,
        });
      } else {
        results.push({ step: "token", status: "erro", message: d?.error?.message || "Token inválido", data: d });
      }
    } catch (e) {
      results.push({ step: "token", status: "erro", message: `Erro de rede: ${(e as Error).message}` });
    }

    const tokenOk = results[0]?.status === "ok";

    // 2) Phone Number ID acessível
    if (!phone_number_id) {
      results.push({ step: "phone", status: "skip", message: "Phone Number ID não informado" });
    } else if (!tokenOk) {
      results.push({ step: "phone", status: "skip", message: "Pulado (token inválido)" });
    } else {
      try {
        const r = await fetch(
          `${META_API}/${phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type&access_token=${access_token}`,
        );
        const d = await r.json();
        if (r.ok && d.id) {
          phone_info = d;
          results.push({
            step: "phone",
            status: "ok",
            message: `Número ${d.display_phone_number} (${d.verified_name || "sem nome"}) — qualidade: ${d.quality_rating || "N/A"}, verificação: ${d.code_verification_status || "N/A"}`,
            data: d,
          });
        } else {
          results.push({
            step: "phone",
            status: "erro",
            message: d?.error?.message || "Phone Number ID inacessível com este token",
            data: d,
          });
        }
      } catch (e) {
        results.push({ step: "phone", status: "erro", message: `Erro de rede: ${(e as Error).message}` });
      }
    }

    // 3) WABA acessível
    if (!waba_id) {
      results.push({ step: "waba", status: "skip", message: "WABA ID não informado" });
    } else if (!tokenOk) {
      results.push({ step: "waba", status: "skip", message: "Pulado (token inválido)" });
    } else {
      try {
        const r = await fetch(
          `${META_API}/${waba_id}?fields=id,name,timezone_id,message_template_namespace&access_token=${access_token}`,
        );
        const d = await r.json();
        if (r.ok && d.id) {
          waba_info = d;
          results.push({
            step: "waba",
            status: "ok",
            message: `WABA acessível: ${d.name || d.id}`,
            data: d,
          });
        } else {
          results.push({
            step: "waba",
            status: "erro",
            message: d?.error?.message || "WABA inacessível com este token",
            data: d,
          });
        }
      } catch (e) {
        results.push({ step: "waba", status: "erro", message: `Erro de rede: ${(e as Error).message}` });
      }
    }

    // 4) WABA ↔ Phone match
    if (waba_id && phone_number_id && tokenOk) {
      try {
        const r = await fetch(`${META_API}/${waba_id}/phone_numbers?access_token=${access_token}`);
        const d = await r.json();
        if (r.ok && Array.isArray(d.data)) {
          const found = d.data.find((p: any) => String(p.id) === String(phone_number_id));
          if (found) {
            results.push({
              step: "vinculo",
              status: "ok",
              message: `Phone Number ID pertence à WABA. Números na WABA: ${d.data.map((p: any) => `${p.display_phone_number} (${p.id})`).join(", ")}`,
              data: d.data,
            });
          } else {
            results.push({
              step: "vinculo",
              status: "erro",
              message: `Phone Number ID NÃO está nesta WABA. Encontrados: ${d.data.map((p: any) => `${p.display_phone_number} (${p.id})`).join(", ") || "nenhum"}`,
              data: d.data,
            });
          }
        } else {
          results.push({ step: "vinculo", status: "erro", message: d?.error?.message || "Falha ao listar números da WABA", data: d });
        }
      } catch (e) {
        results.push({ step: "vinculo", status: "erro", message: `Erro de rede: ${(e as Error).message}` });
      }
    }

    // 5) App ↔ WABA subscription
    if (waba_id && tokenOk) {
      try {
        const r = await fetch(`${META_API}/${waba_id}/subscribed_apps?access_token=${access_token}`);
        const d = await r.json();
        if (r.ok && Array.isArray(d.data)) {
          const tokenAppId = String(token_info?.app_id || "");
          const subscribed = d.data.find((a: any) => String(a.whatsapp_business_api_data?.id || a.id) === tokenAppId);
          if (subscribed) {
            results.push({
              step: "webhook_assinatura",
              status: "ok",
              message: `App ${tokenAppId} já está inscrito nesta WABA`,
              data: d.data,
            });
          } else {
            results.push({
              step: "webhook_assinatura",
              status: "erro",
              message: `App ${tokenAppId} NÃO está inscrito na WABA. Use "Inscrever app" para corrigir.`,
              data: d.data,
            });
          }
        } else {
          results.push({ step: "webhook_assinatura", status: "skip", message: d?.error?.message || "Não foi possível ler assinaturas (scope insuficiente)" });
        }
      } catch (e) {
        results.push({ step: "webhook_assinatura", status: "erro", message: `Erro de rede: ${(e as Error).message}` });
      }
    }

    const ok =
      tokenOk &&
      results.find((r) => r.step === "phone")?.status !== "erro" &&
      results.find((r) => r.step === "waba")?.status !== "erro" &&
      results.find((r) => r.step === "vinculo")?.status !== "erro";

    return new Response(
      JSON.stringify({ ok, token_info, phone_info, waba_info, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
