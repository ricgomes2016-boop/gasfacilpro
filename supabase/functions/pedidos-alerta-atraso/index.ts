// Cron job: detecta pedidos sem alteração de status há mais de 5 minutos
// e dispara um alerta via WhatsApp para o número configurado na unidade.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createSupabase, resolveConfig, sendMessage, type BiaConfig } from "../_shared/bia-core.ts";

const FALLBACK_NOTIFY_NUMBER = "5543999692765";
const STATUS_ABERTOS = ["pendente", "agendado", "em_separacao", "em_rota", "saiu_para_entrega", "confirmado", "preparando"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createSupabase();
  const startedAt = Date.now();
  let processed = 0;
  let alerted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("id, status, status_atualizado_em, cliente_id, endereco_entrega, unidade_id, valor_total, observacoes")
      .in("status", STATUS_ABERTOS)
      .lte("status_atualizado_em", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .is("alerta_atraso_enviado_em", null)
      .limit(50);

    if (error) throw error;
    processed = pedidos?.length || 0;

    for (const ped of pedidos || []) {
      try {
        // Carrega unidade para obter número de notificação
        let destino = FALLBACK_NOTIFY_NUMBER;
        let unidadeNome = "—";
        let empresaId: string | null = null;
        if (ped.unidade_id) {
          const { data: uni } = await supabase
            .from("unidades")
            .select("nome, whatsapp_notificacao_pedido, empresa_id")
            .eq("id", ped.unidade_id)
            .maybeSingle();
          if (uni?.nome) unidadeNome = uni.nome;
          empresaId = uni?.empresa_id || null;
          const configurado = (uni?.whatsapp_notificacao_pedido || "").replace(/\D/g, "");
          if (configurado.length >= 12) destino = configurado;
        }
        if (!destino || destino.replace(/\D/g, "").length < 12) {
          skipped++;
          continue;
        }

        // Descobre provedor ativo da unidade
        let integracao: any = null;
        if (ped.unidade_id) {
          const { data } = await supabase
            .from("integracoes_whatsapp")
            .select("provedor, instance_id, meta_phone_number_id")
            .eq("unidade_id", ped.unidade_id)
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();
          integracao = data;
        }
        // Fallback: outra integração ativa da mesma empresa
        if (!integracao && empresaId) {
          const { data: unidadesDaEmpresa } = await supabase
            .from("unidades")
            .select("id")
            .eq("empresa_id", empresaId);
          const ids = (unidadesDaEmpresa || []).map((u: any) => u.id);
          if (ids.length) {
            const { data } = await supabase
              .from("integracoes_whatsapp")
              .select("provedor, instance_id, meta_phone_number_id, unidade_id")
              .in("unidade_id", ids)
              .eq("ativo", true)
              .limit(1)
              .maybeSingle();
            integracao = data;
          }
        }
        if (!integracao?.provedor) {
          skipped++;
          continue;
        }

        const config: BiaConfig | null = await resolveConfig(
          supabase,
          integracao.provedor,
          integracao.unidade_id || ped.unidade_id,
          integracao.instance_id || integracao.meta_phone_number_id || null,
        );
        if (!config) {
          skipped++;
          continue;
        }

        // Carrega cliente
        let clienteNome = "Cliente";
        let clienteFone = "";
        if (ped.cliente_id) {
          const { data: cli } = await supabase
            .from("clientes")
            .select("nome, telefone")
            .eq("id", ped.cliente_id)
            .maybeSingle();
          if (cli?.nome) clienteNome = cli.nome;
          if (cli?.telefone) clienteFone = cli.telefone;
        }

        const desde = ped.status_atualizado_em ? new Date(ped.status_atualizado_em) : null;
        const desdeFmt = desde
          ? desde.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
          : "—";
        const minutos = desde ? Math.floor((Date.now() - desde.getTime()) / 60000) : 0;

        const msg = [
          `⚠️ *Pedido parado há ${minutos} min*`,
          `🏢 ${unidadeNome}`,
          `🆔 #${String(ped.id).slice(0, 8)}`,
          `📌 Status: *${ped.status}* (desde ${desdeFmt})`,
          `👤 ${clienteNome}${clienteFone ? ` (${clienteFone})` : ""}`,
          ped.endereco_entrega ? `📍 ${ped.endereco_entrega}` : null,
        ].filter(Boolean).join("\n");

        const result = await sendMessage(config, destino, msg);
        if (result.ok) {
          alerted++;
          await supabase
            .from("pedidos")
            .update({ alerta_atraso_enviado_em: new Date().toISOString() })
            .eq("id", ped.id);
        } else {
          errors.push(`pedido ${ped.id}: ${result.error}`);
        }
      } catch (e) {
        errors.push(`pedido ${ped.id}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    errors.push(`query: ${(e as Error).message}`);
  }

  const elapsed = Date.now() - startedAt;
  console.log(JSON.stringify({ fn: "pedidos-alerta-atraso", processed, alerted, skipped, errors: errors.length, elapsed_ms: elapsed }));
  return new Response(
    JSON.stringify({ ok: true, processed, alerted, skipped, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
