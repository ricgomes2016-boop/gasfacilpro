import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

// Sempre responde 200 para evitar reenvios infinitos do Asaas, com flag de status
function ok(payload: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ received: true, ...payload }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const event = body?.event as string | undefined;
    const payment = body?.payment;

    console.log("[asaas-webhook] event:", event, "id:", payment?.id);

    if (!event || !payment?.id) {
      return ok({ ignored: "payload inválido" });
    }

    // Validação opcional de token (configurado por empresa no Asaas)
    const tokenRecebido = req.headers.get("asaas-access-token") ?? "";

    // Busca conta a receber pelo charge id do Asaas
    const { data: conta, error: findErr } = await supabase
      .from("contas_receber")
      .select("id, empresa_id, unidade_id, status, observacoes, valor")
      .eq("asaas_charge_id", payment.id)
      .maybeSingle();

    if (findErr) {
      console.error("[asaas-webhook] erro buscar conta:", findErr);
      return ok({ error: "lookup_failed" });
    }
    if (!conta) {
      console.warn("[asaas-webhook] conta não encontrada para charge", payment.id);
      return ok({ ignored: "conta_nao_encontrada" });
    }

    // Valida token salvo na empresa (se configurado)
    if (conta.empresa_id) {
      const { data: cfg } = await supabase
        .from("configuracoes_empresa")
        .select("asaas_webhook_token")
        .eq("empresa_id", conta.empresa_id)
        .maybeSingle();
      const tokenEsperado = (cfg as any)?.asaas_webhook_token as string | null;
      if (!tokenEsperado) {
        console.warn("[asaas-webhook] token nao configurado para empresa", conta.empresa_id);
        return ok({ ignored: "token_nao_configurado" });
      }
      if (tokenEsperado && tokenEsperado !== tokenRecebido) {
        console.warn("[asaas-webhook] token inválido para empresa", conta.empresa_id);
        return ok({ ignored: "token_invalido" });
      }
    }

    const agora = new Date();
    const hoje = agora.toISOString().slice(0, 10);
    const stamp = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const linhaHist = `[${stamp}] Asaas webhook: ${event}`;
    const novasObs = conta.observacoes
      ? `${conta.observacoes}\n${linhaHist}`
      : linhaHist;

    const update: Record<string, unknown> = { observacoes: novasObs };

    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED_IN_CASH":
        if (conta.status !== "recebida") {
          update.status = "recebida";
          update.data_recebimento =
            (payment.paymentDate as string) ||
            (payment.clientPaymentDate as string) ||
            hoje;
        }
        break;

      case "PAYMENT_OVERDUE":
        if (conta.status === "pendente") update.status = "vencida";
        break;

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_CHARGEBACK_DISPUTE":
        // Mantém histórico; não cancela automaticamente para não apagar caixa.
        break;

      default:
        // Outros eventos só registram no histórico
        break;
    }

    const { error: updErr } = await supabase
      .from("contas_receber")
      .update(update)
      .eq("id", conta.id);

    if (updErr) {
      console.error("[asaas-webhook] erro update:", updErr);
      return ok({ error: "update_failed", detail: updErr.message });
    }

    return ok({ processed: event, conta_id: conta.id });
  } catch (err) {
    console.error("[asaas-webhook] exception:", err);
    return ok({ error: "exception", detail: (err as Error).message });
  }
});
