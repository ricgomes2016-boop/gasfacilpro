// PagBank / PagSeguro API integration
// Stores per-unidade credentials in public.integracoes_config (integracao_id='pagbank')
// Supports: test_connection, get_balance, list_transactions, create_pix_charge,
//           create_boleto_charge, list_orders
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function baseUrl(ambiente: string) {
  return ambiente === "producao"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

async function pagFetch(path: string, token: string, ambiente: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl(ambiente)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const raw = await res.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { _raw: raw }; }
  if (!res.ok) {
    const msg = data?.error_messages?.[0]?.description
      || data?.message
      || `HTTP ${res.status}`;
    throw new Error(`PagBank: ${msg}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const { action, unidade_id, conta_bancaria_id } = body;

    if (!unidade_id) return json({ error: "unidade_id obrigatório" }, 400);

    const { data: integ } = await supabase
      .from("integracoes_config")
      .select("config, ativo")
      .eq("unidade_id", unidade_id)
      .eq("integracao_id", "pagbank")
      .maybeSingle();

    const cfg = (integ?.config || {}) as Record<string, any>;
    const token = cfg.token as string | undefined;
    const ambiente = (cfg.ambiente || "sandbox") as string;
    if (!token) {
      return json({ error: "Token PagBank não configurado para esta unidade." }, 400);
    }

    // ============ test_connection ============
    if (action === "test_connection") {
      try {
        await pagFetch("/public/payment-methods", token, ambiente);
        return json({ success: true, ambiente });
      } catch (e: any) {
        return json({ success: false, error: e.message }, 200);
      }
    }

    // ============ list_transactions ============
    if (action === "list_transactions") {
      const dias = Math.max(1, Math.min(90, Number(body.dias) || 30));
      const since = new Date(Date.now() - dias * 86400000).toISOString();
      // PagBank: GET /orders?initial_date=...
      const url = `/orders?initial_date=${encodeURIComponent(since)}&size=100`;
      const data = await pagFetch(url, token, ambiente);
      const orders: any[] = data?.orders || data?.data || [];
      let importadas = 0;
      for (const o of orders) {
        const charge = (o.charges || [])[0];
        if (!charge) continue;
        const paid = (charge.status || "").toUpperCase() === "PAID";
        if (!paid) continue;
        const valor = (charge?.amount?.value ?? 0) / 100;
        const ref = `pagbank:${o.id}`;
        const { data: existing } = await supabase
          .from("extrato_bancario")
          .select("id")
          .eq("referencia_externa", ref)
          .maybeSingle();
        if (existing) continue;
        await supabase.from("extrato_bancario").insert({
          conta_bancaria_id,
          unidade_id,
          tipo: "credito",
          valor,
          descricao: o.reference_id || charge?.description || `PagBank ${o.id}`,
          data: (charge?.paid_at || o.created_at || since).slice(0, 10),
          referencia_externa: ref,
        });
        importadas++;
      }
      return json({ success: true, importadas, total_retornado: orders.length });
    }

    // ============ get_balance ============
    if (action === "get_balance") {
      // PagBank não tem endpoint público padronizado de balance — usamos sumarização das orders pagas
      const data = await pagFetch("/orders?size=50", token, ambiente);
      return json({ success: true, raw: data });
    }

    // ============ create_pix_charge ============
    if (action === "create_pix_charge") {
      const { valor, descricao, expira_em_minutos = 60, reference_id } = body;
      if (!valor) return json({ error: "valor obrigatório" }, 400);
      const payload = {
        reference_id: reference_id || `gfp-${Date.now()}`,
        customer: body.customer || { name: "Cliente", email: "cliente@example.com" },
        items: [
          { name: descricao || "Cobrança", quantity: 1, unit_amount: Math.round(valor * 100) },
        ],
        qr_codes: [
          {
            amount: { value: Math.round(valor * 100) },
            expiration_date: new Date(Date.now() + expira_em_minutos * 60000).toISOString(),
          },
        ],
      };
      const data = await pagFetch("/orders", token, ambiente, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return json({ success: true, order: data });
    }

    // ============ create_boleto_charge ============
    if (action === "create_boleto_charge") {
      const { valor, descricao, cliente, due_date } = body;
      if (!valor || !cliente) return json({ error: "valor e cliente obrigatórios" }, 400);
      const payload = {
        reference_id: body.reference_id || `gfp-${Date.now()}`,
        customer: cliente,
        items: [{ name: descricao || "Cobrança", quantity: 1, unit_amount: Math.round(valor * 100) }],
        charges: [
          {
            reference_id: body.reference_id || `gfp-${Date.now()}`,
            amount: { value: Math.round(valor * 100), currency: "BRL" },
            payment_method: {
              type: "BOLETO",
              boleto: {
                due_date: due_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                instruction_lines: { line_1: descricao || "Pagamento", line_2: "GasFacilPro" },
                holder: cliente,
              },
            },
          },
        ],
      };
      const data = await pagFetch("/orders", token, ambiente, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return json({ success: true, order: data });
    }

    return json({ error: `Ação "${action}" não reconhecida` }, 400);
  } catch (e: any) {
    console.error("pagbank-api error:", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
