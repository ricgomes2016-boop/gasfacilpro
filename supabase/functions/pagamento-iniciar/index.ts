import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token ausente" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { pedido_id, entregador_id, valor, forma_pagamento, parcelas = 1, maquininha_serial } = body;

    if (!pedido_id || !valor || !forma_pagamento) {
      return new Response(JSON.stringify({ error: "pedido_id, valor e forma_pagamento são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["debito", "credito"].includes(forma_pagamento)) {
      return new Response(JSON.stringify({ error: "forma_pagamento deve ser 'debito' ou 'credito'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: rolesData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id),
    ]);

    const roles = (rolesData || []).map((r: any) => r.role);
    const isSuperAdmin = roles.includes("super_admin");
    const allowedRoles = ["admin", "gestor", "operacional", "financeiro", "entregador"];
    if (!isSuperAdmin && !roles.some((role: string) => allowedRoles.includes(role))) {
      return new Response(JSON.stringify({ error: "Usuário sem permissão para iniciar pagamento" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdmin && !profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Usuário sem empresa vinculada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pedido info for loja_id and empresa_id
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .select("id, unidade_id, valor_total")
      .eq("id", pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdmin) {
      const { data: unidade } = await supabase
        .from("unidades")
        .select("id, empresa_id")
        .eq("id", pedido.unidade_id)
        .maybeSingle();

      if (!unidade || unidade.empresa_id !== profile?.empresa_id) {
        return new Response(JSON.stringify({ error: "Pedido pertence a outra empresa" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate unique transaction_id
    const transaction_id = `TXN_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // Insert payment record
    const { data: pagamento, error: insertError } = await supabase
      .from("pagamentos_cartao")
      .insert({
        pedido_id,
        loja_id: pedido.unidade_id,
        entregador_id: entregador_id || null,
        transaction_id,
        tipo: forma_pagamento,
        parcelas,
        valor_bruto: valor,
        status: "aguardando_maquina",
        maquininha_serial: maquininha_serial || null,
        empresa_id: profile?.empresa_id || null,
        unidade_id: pedido.unidade_id,
      })
      .select("id, transaction_id, status")
      .single();

    if (insertError) {
      console.error("Erro ao criar pagamento:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao iniciar pagamento", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update pedido status
    await supabase
      .from("pedidos")
      .update({ status: "aguardando_pagamento_cartao" })
      .eq("id", pedido_id);

    return new Response(
      JSON.stringify({
        id: pagamento.id,
        transaction_id: pagamento.transaction_id,
        status: "AGUARDANDO_MAQUINA",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Erro interno:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
