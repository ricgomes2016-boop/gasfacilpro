import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireAuth } from "../_shared/auth.ts";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { unidade_id, numero_teste } = await req.json();

    if (!unidade_id) {
      return new Response(JSON.stringify({ error: "unidade_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch credentials
    const { data: config, error: cfgErr } = await supabaseAdmin
      .from("integracoes_whatsapp")
      .select("*")
      .eq("unidade_id", unidade_id)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração WhatsApp não encontrada para esta unidade" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = config.meta_access_token || config.token;
    const phoneId = config.meta_phone_number_id || config.instance_id;
    const wabaId = config.meta_waba_id;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token Meta não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: StepResult[] = [];

    // Step 1: Token válido?
    try {
      const r = await fetch(`${META_API}/me?access_token=${token}`);
      const d = await r.json();
      if (r.ok && d.id) {
        results.push({ step: "token_valido", status: "ok", message: `Token válido. App ID: ${d.id}, Nome: ${d.name || "N/A"}`, data: d });
      } else {
        results.push({ step: "token_valido", status: "erro", message: d.error?.message || "Token inválido", data: d });
      }
    } catch (e) {
      results.push({ step: "token_valido", status: "erro", message: `Erro de rede: ${e.message}` });
    }

    // Step 2: WABA acessível? + auto-discover phone number ID
    let resolvedPhoneId = phoneId;
    if (wabaId && results[0]?.status === "ok") {
      try {
        const r = await fetch(`${META_API}/${wabaId}?access_token=${token}`);
        const d = await r.json();
        if (r.ok && d.id) {
          results.push({ step: "waba_acessivel", status: "ok", message: `WABA acessível: ${d.name || d.id}`, data: d });

          // List phone numbers in WABA (informational only, no auto-overwrite)
          try {
            const pnr = await fetch(`${META_API}/${wabaId}/phone_numbers?access_token=${token}`);
            const pnd = await pnr.json();
            if (pnr.ok && pnd.data?.length) {
              results.push({
                step: "waba_numeros",
                status: "ok",
                message: `Números na WABA: ${pnd.data.map((p: any) => `${p.display_phone_number} (${p.id})`).join(", ")}`,
                data: pnd.data,
              });
            }
          } catch (e) {
            results.push({ step: "waba_numeros", status: "erro", message: `Erro ao listar números: ${e.message}` });
          }
        } else {
          results.push({ step: "waba_acessivel", status: "erro", message: d.error?.message || "WABA não acessível", data: d });
        }
      } catch (e) {
        results.push({ step: "waba_acessivel", status: "erro", message: `Erro de rede: ${e.message}` });
      }
    } else if (!wabaId) {
      results.push({ step: "waba_acessivel", status: "skip", message: "WABA ID não configurado" });
    } else {
      results.push({ step: "waba_acessivel", status: "skip", message: "Pulado (token inválido)" });
    }

    // Step 3: Número registrado?
    if (resolvedPhoneId && results[0]?.status === "ok") {
      try {
        const r = await fetch(`${META_API}/${resolvedPhoneId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,status,webhook_configuration&access_token=${token}`);
        const d = await r.json();
        if (r.ok && d.display_phone_number) {
          const verifExpired = d.code_verification_status === "EXPIRED";
          results.push({
            step: "numero_registrado",
            status: verifExpired ? "erro" : "ok",
            message: verifExpired
              ? `⚠️ Verificação em 2 etapas EXPIRADA no número ${d.display_phone_number}. A Meta para de entregar mensagens enquanto isso. Acesse Meta Business → WhatsApp Manager → Números → reenvie o PIN.`
              : `Número: ${d.display_phone_number} | Status: ${d.code_verification_status || "N/A"} | Qualidade: ${d.quality_rating || "N/A"}`,
            data: d,
          });

          // Step 3b: Webhook configurado no número aponta para nosso endpoint?
          const expectedWebhook = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-webhook`;
          const configuredWebhook = d.webhook_configuration?.application || null;
          if (configuredWebhook) {
            const matches = configuredWebhook.includes("/functions/v1/meta-webhook");
            results.push({
              step: "webhook_configurado",
              status: matches ? "ok" : "erro",
              message: matches
                ? `Webhook OK: ${configuredWebhook}`
                : `Webhook aponta para outro endereço: ${configuredWebhook}. Esperado: ${expectedWebhook}`,
              data: { configured: configuredWebhook, expected: expectedWebhook },
            });
          } else {
            results.push({
              step: "webhook_configurado",
              status: "erro",
              message: `Nenhum webhook configurado neste número. Configure ${expectedWebhook} em Meta for Developers → App → WhatsApp → Configuração → Webhook.`,
              data: { expected: expectedWebhook },
            });
          }
        } else {
          const errCode = d.error?.code;
          const errMsg = d.error?.message || "Erro desconhecido";
          results.push({
            step: "numero_registrado",
            status: "erro",
            message: errCode === 133010
              ? "Número NÃO registrado na Cloud API (erro 133010). Registre via painel Meta ou etapa seguinte."
              : `Erro ${errCode}: ${errMsg}`,
            data: d,
          });
        }
      } catch (e) {
        results.push({ step: "numero_registrado", status: "erro", message: `Erro de rede: ${e.message}` });
      }
    } else if (!resolvedPhoneId) {
      results.push({ step: "numero_registrado", status: "skip", message: "Phone Number ID não configurado" });
    } else {
      results.push({ step: "numero_registrado", status: "skip", message: "Pulado (token inválido)" });
    }

    // Step 3c: App inscrito no WABA?
    if (wabaId && results[0]?.status === "ok") {
      try {
        const r = await fetch(`${META_API}/${wabaId}/subscribed_apps?access_token=${token}`);
        const d = await r.json();
        if (r.ok && Array.isArray(d.data)) {
          if (d.data.length > 0) {
            const apps = d.data.map((a: any) => a.whatsapp_business_api_data?.name || a.whatsapp_business_api_data?.id).join(", ");
            results.push({ step: "subscribed_apps", status: "ok", message: `App(s) inscrito(s) no WABA: ${apps}`, data: d.data });
          } else {
            results.push({
              step: "subscribed_apps",
              status: "erro",
              message: "Nenhum app inscrito no WABA. Em Meta for Developers → App → WhatsApp → Configuração, clique em 'Inscrever' no webhook e marque o campo 'messages'.",
              data: d,
            });
          }
        } else {
          results.push({ step: "subscribed_apps", status: "erro", message: d.error?.message || "Falha ao consultar subscribed_apps", data: d });
        }
      } catch (e) {
        results.push({ step: "subscribed_apps", status: "erro", message: `Erro de rede: ${e.message}` });
      }
    } else {
      results.push({ step: "subscribed_apps", status: "skip", message: "Pulado (sem WABA ou token inválido)" });
    }

    // Step 4: Registro automático
    const numRegistrado = results.find((r) => r.step === "numero_registrado");
    if (resolvedPhoneId && numRegistrado?.status === "erro" && results[0]?.status === "ok") {
      try {
        const r = await fetch(`${META_API}/${resolvedPhoneId}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messaging_product: "whatsapp", pin: "123456" }),
        });
        const d = await r.json();
        if (r.ok && d.success) {
          results.push({ step: "registro_api", status: "ok", message: "Número registrado com sucesso via API!", data: d });
          await supabaseAdmin
            .from("integracoes_whatsapp")
            .update({ status_conexao: "conectado", ultima_verificacao: new Date().toISOString() })
            .eq("id", config.id);
        } else {
          results.push({ step: "registro_api", status: "erro", message: d.error?.message || "Falha no registro via API", data: d });
        }
      } catch (e) {
        results.push({ step: "registro_api", status: "erro", message: `Erro de rede: ${e.message}` });
      }
    } else if (numRegistrado?.status === "ok") {
      results.push({ step: "registro_api", status: "skip", message: "Número já registrado, não necessário" });
    } else {
      results.push({ step: "registro_api", status: "skip", message: "Pulado" });
    }

    // Step 5: Envio de mensagem teste
    if (numero_teste && resolvedPhoneId && results[0]?.status === "ok") {
      const formattedNumber = numero_teste.replace(/\D/g, "");
      const fullNumber = formattedNumber.startsWith("55") ? formattedNumber : `55${formattedNumber}`;
      try {
        const r = await fetch(`${META_API}/${resolvedPhoneId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: fullNumber,
            type: "text",
            text: { body: "✅ Diagnóstico GásFácil PRO: Integração Meta WhatsApp funcionando!" },
          }),
        });
        const d = await r.json();
        if (r.ok && d.messages?.[0]?.id) {
          results.push({ step: "envio_teste", status: "ok", message: `Mensagem enviada! ID: ${d.messages[0].id}`, data: d });
          // Update connected
          await supabaseAdmin
            .from("integracoes_whatsapp")
            .update({ status_conexao: "conectado", ultima_verificacao: new Date().toISOString() })
            .eq("id", config.id);
        } else {
          results.push({ step: "envio_teste", status: "erro", message: d.error?.message || "Falha no envio", data: d });
        }
      } catch (e) {
        results.push({ step: "envio_teste", status: "erro", message: `Erro de rede: ${e.message}` });
      }
    } else if (!numero_teste) {
      results.push({ step: "envio_teste", status: "skip", message: "Nenhum número de teste informado" });
    } else {
      results.push({ step: "envio_teste", status: "skip", message: "Pulado (pré-requisitos falharam)" });
    }

    return new Response(
      JSON.stringify({
        config_id: config.id,
        provedor: config.provedor,
        phone_id: resolvedPhoneId,
        waba_id: wabaId,
        numero: config.numero_telefone,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
