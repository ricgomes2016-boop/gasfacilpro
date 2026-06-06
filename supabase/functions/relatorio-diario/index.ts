// relatorio-diario — Envia resumo diário de KPIs via WhatsApp para o gestor
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;
    if (!auth.isServiceRole) {
      return new Response(JSON.stringify({ error: "Apenas chamadas do cron (service_role)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get all empresas with relatorio_diario enabled
    const { data: configs } = await supabase
      .from("configuracoes_empresa")
      .select("empresa_id, regras_bia");

    if (!configs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "Nenhuma config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const cfg of configs) {
      const regras = cfg.regras_bia as any;
      if (!regras?.relatorio_diario_ativo || !regras?.relatorio_diario_telefone) continue;

      const phone = regras.relatorio_diario_telefone.replace(/\D/g, "");
      if (phone.length < 10) continue;

      // Get unidades for this empresa
      const { data: unidades } = await supabase
        .from("unidades").select("id, nome").eq("empresa_id", cfg.empresa_id);
      
      const unidadeIds = (unidades || []).map((u: any) => u.id);
      if (!unidadeIds.length) continue;

      // Today's date range (BRT)
      const now = new Date();
      const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
      const today = brt.toISOString().split("T")[0];

      // Get today's orders
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, valor_total, status, canal_venda, created_at")
        .in("unidade_id", unidadeIds)
        .gte("created_at", today + "T00:00:00")
        .lte("created_at", today + "T23:59:59");

      const totalPedidos = pedidos?.length || 0;
      const entregues = (pedidos || []).filter((p: any) => p.status === "entregue").length;
      const pendentes = (pedidos || []).filter((p: any) => ["pendente", "em_preparo", "saiu_entrega"].includes(p.status)).length;
      const cancelados = (pedidos || []).filter((p: any) => p.status === "cancelado").length;
      const faturamento = (pedidos || []).reduce((sum: number, p: any) => sum + (p.valor_total || 0), 0);

      // Canal breakdown
      const canalMap: Record<string, number> = {};
      for (const p of pedidos || []) {
        const canal = p.canal_venda || "balcão";
        canalMap[canal] = (canalMap[canal] || 0) + 1;
      }
      const canalBreakdown = Object.entries(canalMap)
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `  • ${c}: ${n}`)
        .join("\n");

      // Top products
      const { data: itens } = await supabase
        .from("pedido_itens")
        .select("quantidade, produtos:produto_id(nome)")
        .in("pedido_id", (pedidos || []).map((p: any) => p.id));

      const prodMap: Record<string, number> = {};
      for (const item of itens || []) {
        const nome = (item as any).produtos?.nome || "Outro";
        prodMap[nome] = (prodMap[nome] || 0) + (item.quantidade || 1);
      }
      const topProducts = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([n, q]) => `  • ${n}: ${q} un`)
        .join("\n");

      // Build message
      const msg = `📊 *Relatório do Dia — ${today}*\n\n` +
        `📦 *Pedidos:* ${totalPedidos}\n` +
        `  ✅ Entregues: ${entregues}\n` +
        `  ⏳ Pendentes: ${pendentes}\n` +
        `  ❌ Cancelados: ${cancelados}\n\n` +
        `💰 *Faturamento:* R$ ${faturamento.toFixed(2)}\n\n` +
        (canalBreakdown ? `📱 *Por Canal:*\n${canalBreakdown}\n\n` : "") +
        (topProducts ? `🏆 *Top Produtos:*\n${topProducts}\n\n` : "") +
        `_Relatório gerado automaticamente pela Bia_ 🤖`;

      // Find WhatsApp integration for this empresa
      const { data: integracoes } = await supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("ativo", true)
        .in("unidade_id", unidadeIds)
        .limit(1);

      const integration = integracoes?.[0];
      if (!integration) continue;

      // Send via provider
      let sendOk = false;
      if (integration.provedor === "evolution") {
        const baseUrl = integration.base_url?.replace(/\/$/, "") || "";
        if (baseUrl) {
          const resp = await fetch(`${baseUrl}/message/sendText/${integration.instance_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: integration.token },
            body: JSON.stringify({ number: `55${phone}@s.whatsapp.net`, text: msg }),
          });
          sendOk = resp.ok;
        }
      } else if (integration.provedor === "uazapi") {
        const resp = await fetch(`https://free.uazapi.com/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": integration.token },
          body: JSON.stringify({ number: phone, text: msg }),
        });
        sendOk = resp.ok;
      } else {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (integration.security_token) headers["Client-Token"] = integration.security_token;
        const resp = await fetch(
          `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.token}/send-text`,
          { method: "POST", headers, body: JSON.stringify({ phone: `55${phone}`, message: msg }) }
        );
        sendOk = resp.ok;
      }

      if (sendOk) {
        sent++;
        console.log(`Daily report sent for empresa ${cfg.empresa_id}`);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("relatorio-diario error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
