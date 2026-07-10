// Liquida automaticamente contas_receber de cartão/pix-maq/gás-do-povo vencidas.
// Roda diariamente via pg_cron. Idempotente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "1";
    const upTo = url.searchParams.get("up_to"); // yyyy-mm-dd opcional para backfill
    const hoje = upTo || new Date().toISOString().slice(0, 10);

    const { data: pendentes, error } = await supabase
      .from("contas_receber")
      .select("id, valor, valor_liquido, vencimento, forma_pagamento, conta_bancaria_destino_id, unidade_id, descricao, pedido_id, operadora_id")
      .eq("status", "pendente")
      .in("forma_pagamento", ["cartao_credito", "cartao_debito", "pix_maquininha", "gas_do_povo"])
      .not("conta_bancaria_destino_id", "is", null)
      .lte("vencimento", hoje)
      .limit(5000);

    if (error) throw error;

    let liquidados = 0;
    let pulados = 0;
    let creditadosTotal = 0;
    const erros: any[] = [];

    for (const r of pendentes || []) {
      try {
        const valorLiq = Number(r.valor_liquido ?? r.valor) || 0;
        const contaId = r.conta_bancaria_destino_id as string;

        // Idempotência: já existe movimentação bancária para este recebível?
        const { data: jaMov } = await supabase
          .from("movimentacoes_bancarias")
          .select("id")
          .eq("referencia_id", r.id)
          .eq("referencia_tipo", "conta_receber")
          .eq("categoria", "liquidacao_operadora")
          .maybeSingle();

        if (dryRun) { pulados++; continue; }

        // 1. Marca recebido
        await supabase
          .from("contas_receber")
          .update({ status: "recebido", data_recebimento: r.vencimento })
          .eq("id", r.id);

        // 2. Cria movimentação bancária (se ainda não existe)
        if (!jaMov) {
          const { data: conta } = await supabase
            .from("contas_bancarias")
            .select("saldo_atual")
            .eq("id", contaId)
            .single();
          if (!conta) { pulados++; continue; }
          const novoSaldo = Number(conta.saldo_atual) + valorLiq;

          await supabase.from("movimentacoes_bancarias").insert({
            conta_bancaria_id: contaId,
            data: r.vencimento,
            tipo: "entrada",
            categoria: "liquidacao_operadora",
            descricao: `Liquidação automática — ${r.descricao || r.forma_pagamento}`,
            valor: valorLiq,
            saldo_apos: novoSaldo,
            referencia_id: r.id,
            referencia_tipo: "conta_receber",
            unidade_id: r.unidade_id,
          });

          await supabase
            .from("contas_bancarias")
            .update({ saldo_atual: novoSaldo })
            .eq("id", contaId);

          creditadosTotal += valorLiq;
        }
        liquidados++;
      } catch (e: any) {
        erros.push({ id: r.id, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        data_referencia: hoje,
        total_pendentes: pendentes?.length || 0,
        liquidados,
        pulados,
        credito_total: creditadosTotal,
        erros,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("liquidar-recebiveis-cartao error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
