import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active contracts with proxima_entrega <= today
    const today = new Date().toISOString().split("T")[0];

    const { data: contratos, error: fetchError } = await supabase
      .from("contratos_recorrentes")
      .select("*")
      .eq("status", "ativo")
      .lte("proxima_entrega", today);

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }

    if (!contratos || contratos.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum contrato para processar", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const contrato of contratos) {
      try {
        // 1. Create the order
        const { data: pedido, error: pedidoError } = await supabase
          .from("pedidos")
          .insert({
            cliente_id: contrato.cliente_id,
            valor_total: Number(contrato.valor_unitario) * contrato.quantidade,
            forma_pagamento: "a_definir",
            status: "pendente",
            canal_venda: "Assinatura",
            observacoes: `Pedido automático - Assinatura recorrente (${contrato.frequencia})`,
            unidade_id: contrato.unidade_id,
          })
          .select("id")
          .single();

        if (pedidoError || !pedido) {
          console.error(`Error creating order for contract ${contrato.id}:`, pedidoError);
          errors++;
          continue;
        }

        // 2. Add order items
        if (contrato.produto_id) {
          await supabase.from("pedido_itens").insert({
            pedido_id: pedido.id,
            produto_id: contrato.produto_id,
            produto_nome: contrato.produto_nome,
            quantidade: contrato.quantidade,
            preco_unitario: Number(contrato.valor_unitario),
          });
        }

        // 3. Calculate next delivery date
        const currentDate = new Date(contrato.proxima_entrega);
        let nextDate: Date;

        switch (contrato.frequencia) {
          case "semanal":
            nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "quinzenal":
            nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case "bimestral":
            nextDate = new Date(currentDate);
            nextDate.setMonth(nextDate.getMonth() + 2);
            break;
          default: // mensal
            nextDate = new Date(currentDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        }

        // 4. Update contract
        await supabase
          .from("contratos_recorrentes")
          .update({
            proxima_entrega: nextDate.toISOString().split("T")[0],
            entregas_realizadas: (contrato.entregas_realizadas || 0) + 1,
          })
          .eq("id", contrato.id);

        // 5. Notify the client
        // Find user_id from cliente email
        const { data: cliente } = await supabase
          .from("clientes")
          .select("email")
          .eq("id", contrato.cliente_id)
          .single();

        if (cliente?.email) {
          const { data: authUser } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", cliente.email)
            .single();

          if (authUser?.user_id) {
            await supabase.from("notificacoes").insert({
              user_id: authUser.user_id,
              tipo: "pedido",
              titulo: "📦 Entrega recorrente agendada!",
              mensagem: `Seu pedido de ${contrato.produto_nome} (${contrato.quantidade}x) foi gerado automaticamente.`,
              link: "/cliente/historico",
            });
          }
        }

        processed++;
      } catch (e) {
        console.error(`Error processing contract ${contrato.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processamento concluído`,
        processed,
        errors,
        total: contratos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-recurring-orders error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
