// bia-followup-cron — Reengaja cliente após 5min sem fechar pedido, oferecendo R$5 de desconto
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabase, resolveConfig, checkBusinessHours,
  findCliente, sendMessage, saveMessage,
} from "../_shared/bia-core.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const OK = (d: any) => new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (!auth.ok) return auth.response;
  if (!auth.isServiceRole) {
    return new Response(JSON.stringify({ error: "Forbidden: cron-only endpoint" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createSupabase();

  const { data: dueList, error } = await supabase
    .from("bia_followups")
    .select("*")
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .limit(50);

  if (error) { console.error("bia-followup-cron query:", error); return OK({ ok: true, error: error.message }); }
  if (!dueList?.length) return OK({ ok: true, processed: 0 });

  let sent = 0, skipped = 0;
  for (const fu of dueList) {
    try {
      // Sem unidade não dá pra resolver config nem horário
      if (!fu.unidade_id) {
        await supabase.from("bia_followups").update({ status: "cancelado" }).eq("id", fu.id);
        skipped++; continue;
      }

      // Pedido recente já criado? marca convertido
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recent } = await supabase.from("pedidos").select("id")
        .eq("canal_venda", "whatsapp").gte("created_at", since)
        .ilike("observacoes", `%${fu.telefone}%`).limit(1);
      if (recent?.length) {
        await supabase.from("bia_followups").update({ status: "convertido" }).eq("id", fu.id);
        skipped++; continue;
      }

      // Horário comercial
      const bh = await checkBusinessHours(supabase, fu.unidade_id);
      if (bh.isOffHours) {
        // reagenda 30min depois pra tentar quando abrir
        await supabase.from("bia_followups").update({ agendado_para: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq("id", fu.id);
        skipped++; continue;
      }

      // Última msg deve ter sido da Bia (assistant)
      const { data: lastMsgArr } = await supabase.from("ai_mensagens")
        .select("role, content, created_at")
        .eq("conversa_id", fu.conversa_id)
        .order("created_at", { ascending: false }).limit(1);
      const lastMsg = lastMsgArr?.[0];
      if (!lastMsg || lastMsg.role !== "assistant") {
        await supabase.from("bia_followups").update({ status: "cancelado" }).eq("id", fu.id);
        skipped++; continue;
      }

      // Resolve provedor: tenta gateway, depois meta, evolution, uazapi
      let config = null as any;
      for (const prov of ["gateway", "meta", "evolution", "uazapi"] as const) {
        config = await resolveConfig(supabase, prov as any, fu.unidade_id, null);
        if (config) break;
      }
      if (!config) {
        console.warn("bia-followup-cron: no config for unidade", fu.unidade_id);
        await supabase.from("bia_followups").update({ status: "cancelado" }).eq("id", fu.id);
        skipped++; continue;
      }

      const cliente = await findCliente(supabase, fu.telefone);
      const primeiroNome = (cliente?.nome || "").split(" ")[0] || "";
      const saudacao = primeiroNome ? `Oi ${primeiroNome}! 👋` : "Oi! 👋";
      const desconto = Number(fu.desconto_oferecido || 5).toFixed(2).replace(".", ",");
      const msg = `${saudacao} Vi que você se interessou pelo nosso gás mas ainda não fechou. Pra te ajudar a decidir agora, libero *R$ ${desconto} de desconto* no seu pedido. Posso anotar? 🔥`;

      const res = await sendMessage(config, fu.telefone, msg);
      if (!res.ok) {
        await supabase.from("bia_followups").update({ tentativas: (fu.tentativas || 0) + 1, agendado_para: new Date(Date.now() + 10 * 60 * 1000).toISOString() }).eq("id", fu.id);
        continue;
      }

      await saveMessage(supabase, fu.conversa_id, "assistant", msg, {
        source: "bia-followup-cron", follow_up: true, desconto_oferecido: Number(fu.desconto_oferecido || 5), message_id: res.waMessageId,
      });

      await supabase.from("bia_followups").update({ status: "enviado", enviado_em: new Date().toISOString(), tentativas: (fu.tentativas || 0) + 1 }).eq("id", fu.id);
      sent++;
    } catch (e) {
      console.error("bia-followup-cron item error:", e);
    }
  }

  return OK({ ok: true, processed: dueList.length, sent, skipped });
});
