// escalacao-pedidos-bia — Avisa gestor por WhatsApp quando pedido criado pela Bia
// permanece em 'pendente' por mais de 10min e ninguém leu a notificação.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConfig, sendMessage } from "../_shared/bia-core.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GESTOR_WHATSAPP = Deno.env.get("GESTOR_WHATSAPP_NUMBER") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (!auth.ok) return auth.response;
  if (!auth.isServiceRole) {
    return new Response(JSON.stringify({ error: "Apenas chamadas do cron (service_role)" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!GESTOR_WHATSAPP) {
    return new Response(JSON.stringify({ ok: false, erro: "GESTOR_WHATSAPP_NUMBER não configurado" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Pedidos criados pela Bia (whatsapp/telefone_ia), ainda 'pendente',
    // criados há > 10min e que nunca foram escalados.
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("id, numero_sequencial, valor_total, canal_venda, unidade_id, cliente_id, endereco_entrega, created_at")
      .in("canal_venda", ["whatsapp", "telefone_ia"])
      .eq("status", "pendente")
      .is("escalado_em", null)
      .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(50);

    if (error) throw error;
    if (!pedidos?.length) {
      return new Response(JSON.stringify({ ok: true, escalados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let escalados = 0;
    const erros: any[] = [];

    for (const p of pedidos) {
      try {
        const ref = p.numero_sequencial ?? String(p.id).slice(0, 8).toUpperCase();

        // Verifica se existe notificação relacionada NÃO LIDA para este pedido.
        // O trigger fn_notificar_admins_pedido grava a mensagem com "Pedido #<ref>".
        const { data: notifs } = await supabase
          .from("notificacoes")
          .select("id, lida")
          .eq("tipo", "pedido")
          .ilike("mensagem", `Pedido #${ref}%`)
          .limit(10);

        const algumaLida = (notifs ?? []).some((n: any) => n.lida === true);
        if (algumaLida) {
          // Operador já viu, não escalar; apenas marca para não reprocessar.
          await supabase
            .from("pedidos")
            .update({ escalado_em: new Date().toISOString(), escalado_para: "visto_no_sistema" })
            .eq("id", p.id);
          continue;
        }

        // Resolver cliente (nome + telefone)
        let clienteNome = "Cliente";
        if (p.cliente_id) {
          const { data: c } = await supabase
            .from("clientes")
            .select("nome")
            .eq("id", p.cliente_id)
            .maybeSingle();
          if (c?.nome) clienteNome = c.nome;
        }

        // Resolver conexão WhatsApp ativa da unidade do pedido
        const provedores = ["meta", "evolution", "zapi", "uazapi", "gateway"] as const;
        let config: any = null;
        for (const prov of provedores) {
          config = await resolveConfig(supabase, prov, p.unidade_id, null);
          if (config) break;
        }

        if (!config) {
          erros.push({ pedido_id: p.id, erro: "sem_conexao_whatsapp" });
          continue;
        }

        const minutos = Math.round(
          (Date.now() - new Date(p.created_at).getTime()) / 60000,
        );
        const valor = Number(p.valor_total || 0).toFixed(2).replace(".", ",");

        const msg =
          `⚠️ *Pedido sem conferência*\n\n` +
          `Pedido #${ref} (${p.canal_venda === "telefone_ia" ? "telefone" : "WhatsApp"}) ` +
          `foi finalizado pela Bia há *${minutos} minutos* e ainda não foi visualizado no sistema.\n\n` +
          `• Cliente: ${clienteNome}\n` +
          `• Valor: R$ ${valor}\n` +
          `• Endereço: ${p.endereco_entrega ?? "-"}\n\n` +
          `Abra o ERP e confirme o pedido para que ele saia para entrega.`;

        await sendMessage(config, GESTOR_WHATSAPP, msg);

        await supabase
          .from("pedidos")
          .update({
            escalado_em: new Date().toISOString(),
            escalado_para: GESTOR_WHATSAPP,
          })
          .eq("id", p.id);

        escalados++;
      } catch (e: any) {
        erros.push({ pedido_id: p.id, erro: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, escalados, total: pedidos.length, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, erro: String(e?.message ?? e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
