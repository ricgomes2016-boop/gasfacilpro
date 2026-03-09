// status-notification-dispatch — Envia notificações de status via WhatsApp
// Chamado por cron ou manualmente para processar a fila de notificações
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch pending notifications (max 50 per batch)
    const { data: notifs } = await supabase
      .from("notificacoes_status_pedido")
      .select("*, pedidos:pedido_id(unidade_id)")
      .eq("enviado", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!notifs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "Nenhuma notificação pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all active WhatsApp integrations
    const { data: integracoes } = await supabase
      .from("integracoes_whatsapp")
      .select("*")
      .eq("ativo", true);

    if (!integracoes?.length) {
      return new Response(JSON.stringify({ sent: 0, error: "Nenhuma integração WhatsApp ativa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const notif of notifs) {
      try {
        if (!notif.telefone || !notif.mensagem) continue;

        const phone = notif.telefone.replace(/\D/g, "");
        if (phone.length < 10) continue;

        // Find integration for this unit
        const unidadeId = notif.pedidos?.unidade_id;
        let integration = integracoes.find((i: any) => i.unidade_id === unidadeId);
        if (!integration) integration = integracoes.length === 1 ? integracoes[0] : null;
        if (!integration) continue;

        // Send via Z-API or UaZapi
        let sendOk = false;
        if (integration.provedor === "uazapi") {
          const resp = await fetch(`https://free.uazapi.com/message/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": integration.token },
            body: JSON.stringify({ number: phone, text: notif.mensagem }),
          });
          sendOk = resp.ok;
        } else {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (integration.security_token) headers["Client-Token"] = integration.security_token;
          const resp = await fetch(
            `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.token}/send-text`,
            { method: "POST", headers, body: JSON.stringify({ phone: `55${phone}`, message: notif.mensagem }) }
          );
          sendOk = resp.ok;
        }

        if (sendOk) {
          await supabase.from("notificacoes_status_pedido").update({ enviado: true }).eq("id", notif.id);
          sent++;
        } else {
          failed++;
        }

        // Rate limit
        if ((sent + failed) % 5 === 0) await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error("Notification send error:", e);
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: notifs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("status-notification-dispatch error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
