// Edge function: notificar-agendamentos
// Roda a cada 1 min via pg_cron. Para cada pedido agendado com data_agendamento
// entre now() e now()+10min e sem lembrete_enviado_em, cria notificacao
// para admins/gestores/atendentes da empresa daquela unidade.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const agora = new Date();
    const limite = new Date(agora.getTime() + 10 * 60 * 1000);

    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("id, numero_sequencial, cliente_id, unidade_id, data_agendamento, endereco_entrega, bairro_entrega, observacoes, status, clientes(nome)")
      .eq("agendado", true)
      .is("lembrete_enviado_em", null)
      .in("status", ["pendente", "confirmado", "em_rota"])
      .gte("data_agendamento", agora.toISOString())
      .lte("data_agendamento", limite.toISOString());

    if (error) throw error;

    let criadas = 0;

    for (const p of pedidos || []) {
      const ref = p.numero_sequencial != null ? String(p.numero_sequencial) : (p.id as string).substring(0, 8).toUpperCase();
      const dt = new Date(p.data_agendamento as string);
      const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      const cliNome = (p as any).clientes?.nome || "Cliente";
      const bairro = (p as any).bairro_entrega ? ` · ${(p as any).bairro_entrega}` : "";

      // Pega empresa da unidade
      let empresa_id: string | null = null;
      if (p.unidade_id) {
        const { data: u } = await supabase.from("unidades").select("empresa_id").eq("id", p.unidade_id).maybeSingle();
        empresa_id = u?.empresa_id || null;
      }

      // Pega usuários admin/gestor da empresa
      let userIds: string[] = [];
      if (empresa_id) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id").eq("empresa_id", empresa_id);
        const ids = (profs || []).map((x: any) => x.user_id);
        if (ids.length) {
          const { data: roles } = await supabase
            .from("user_roles").select("user_id").in("user_id", ids)
            .in("role", ["admin", "gestor", "atendente"]);
          userIds = (roles || []).map((x: any) => x.user_id);
        }
      }

      if (userIds.length) {
        const rows = userIds.map((uid) => ({
          user_id: uid,
          tipo: "agendamento",
          titulo: "⏰ Agendamento em 10 min",
          mensagem: `Pedido #${ref} · ${cliNome}${bairro} · entrega às ${hora}`,
          link: "/vendas/pedidos",
        }));
        await supabase.from("notificacoes").insert(rows);
      }

      await supabase.from("pedidos").update({ lembrete_enviado_em: new Date().toISOString() }).eq("id", p.id);
      criadas++;
    }

    return new Response(JSON.stringify({ ok: true, processados: criadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notificar-agendamentos error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
