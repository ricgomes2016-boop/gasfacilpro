import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays } from "https://esm.sh/date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

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
      return new Response(JSON.stringify({ error: "Usuário sem permissão para confirmar pagamento" }), {
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

    const body = await req.json();
    const {
      transaction_id,
      nsu,
      codigo_autorizacao,
      bandeira,
      tipo,
      parcelas,
      valor_bruto,
      valor_taxa,
      valor_liquido,
      status,
    } = body;

    if (!transaction_id || !status) {
      return new Response(JSON.stringify({ error: "transaction_id e status são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find existing payment
    const { data: pagamento, error: findError } = await supabase
      .from("pagamentos_cartao")
      .select("*, pedidos(id, cliente_id, unidade_id)")
      .eq("transaction_id", transaction_id)
      .single();

    if (findError || !pagamento) {
      return new Response(JSON.stringify({ error: "Transação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdmin) {
      const { data: unidade } = await supabase
        .from("unidades")
        .select("id, empresa_id")
        .eq("id", pagamento.unidade_id)
        .maybeSingle();

      if (!unidade || unidade.empresa_id !== profile?.empresa_id || pagamento.empresa_id !== profile?.empresa_id) {
        return new Response(JSON.stringify({ error: "Transação pertence a outra empresa" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const isAprovado = status === "APROVADO";
    const tipoFinal = tipo || pagamento.tipo;
    const parcelasFinal = parcelas || pagamento.parcelas;

    // Calculate liquidation date: débito = D+1, crédito = D+30
    const prazo = tipoFinal === "debito" ? 1 : 30;
    const dataPrevisaoLiquidacao = formatDate(addDays(new Date(), prazo));

    // Update payment record
    const updateData: Record<string, unknown> = {
      nsu: nsu || null,
      autorizacao: codigo_autorizacao || null,
      bandeira: bandeira || null,
      tipo: tipoFinal,
      parcelas: parcelasFinal,
      valor_bruto: valor_bruto || pagamento.valor_bruto,
      valor_taxa: valor_taxa || 0,
      valor_liquido: valor_liquido || (valor_bruto || pagamento.valor_bruto) - (valor_taxa || 0),
      status: isAprovado ? "aprovado" : "negado",
      data_prevista_liquidacao: isAprovado ? dataPrevisaoLiquidacao : null,
    };

    const { error: updateError } = await supabase
      .from("pagamentos_cartao")
      .update(updateData)
      .eq("id", pagamento.id);

    if (updateError) {
      console.error("Erro ao atualizar pagamento:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao confirmar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isAprovado && pagamento.pedido_id) {
      // Update pedido status to pago_cartao
      await supabase
        .from("pedidos")
        .update({ status: "pago_cartao", forma_pagamento: tipoFinal === "debito" ? "cartao_debito" : "cartao_credito" })
        .eq("id", pagamento.pedido_id);

      // Create contas_receber record for financial tracking
      const pedidoData = pagamento.pedidos as any;
      const tipoLabel = tipoFinal === "debito" ? "Débito" : `Crédito ${parcelasFinal}x`;
      const pedidoRef = pagamento.pedido_id.slice(0, 8);

      // Look for operator config
      const { data: operadora } = await supabase
        .from("operadoras_cartao")
        .select("id, nome")
        .or(`unidade_id.eq.${pagamento.unidade_id},unidade_id.is.null`)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      const { data: contaReceber, error: crError } = await supabase
        .from("contas_receber")
        .insert({
          cliente: operadora?.nome || "PagBank Maquininha",
          descricao: `${tipoLabel} (Maq.) - Venda #${pedidoRef} - NSU ${nsu || "N/A"}`,
          valor: valor_bruto || pagamento.valor_bruto,
          vencimento: dataPrevisaoLiquidacao,
          status: "pendente",
          forma_pagamento: tipoFinal === "debito" ? "cartao_debito" : "cartao_credito",
          pedido_id: pagamento.pedido_id,
          unidade_id: pagamento.unidade_id,
          operadora_id: operadora?.id || null,
          taxa_percentual: valor_taxa && valor_bruto ? ((valor_taxa / valor_bruto) * 100) : 0,
          valor_taxa: valor_taxa || 0,
          valor_liquido: valor_liquido || (valor_bruto || pagamento.valor_bruto) - (valor_taxa || 0),
          cliente_id: pedidoData?.cliente_id || null,
        })
        .select("id")
        .single();

      // Link conta_receber to pagamento_cartao
      if (contaReceber) {
        await supabase
          .from("pagamentos_cartao")
          .update({ conta_receber_id: contaReceber.id })
          .eq("id", pagamento.id);
      }

      if (crError) {
        console.error("Erro ao criar conta a receber:", crError);
      }

      // Notification
      await supabase.from("notificacoes").insert({
        titulo: "💳 Pagamento Aprovado",
        mensagem: `Venda #${pedidoRef} — ${tipoLabel} ${bandeira || ""} R$ ${Number(valor_bruto || pagamento.valor_bruto).toFixed(2)} NSU: ${nsu || "N/A"}`,
        tipo: "info",
        user_id: user.id,
      });
    } else if (!isAprovado && pagamento.pedido_id) {
      // Payment denied
      await supabase
        .from("pedidos")
        .update({ status: "pagamento_negado" })
        .eq("id", pagamento.pedido_id);

      await supabase.from("notificacoes").insert({
        titulo: "❌ Pagamento Negado",
        mensagem: `Venda #${pagamento.pedido_id.slice(0, 8)} — Transação negada pela operadora.`,
        tipo: "alerta",
        user_id: user.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: isAprovado ? "APROVADO" : "NEGADO",
        transaction_id,
        data_prevista_liquidacao: isAprovado ? dataPrevisaoLiquidacao : null,
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
