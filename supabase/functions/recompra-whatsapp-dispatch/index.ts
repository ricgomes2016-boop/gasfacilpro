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
    if (!auth.isServiceRole) {
      return new Response(JSON.stringify({ error: "Apenas chamadas do cron (service_role)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active WhatsApp integrations
    const { data: integracoes } = await supabase
      .from("integracoes_whatsapp")
      .select("*")
      .eq("ativo", true);

    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma integração ativa", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if recompra is enabled per empresa config
    const { data: allConfigs } = await supabase
      .from("configuracoes_empresa")
      .select("empresa_id, regras_bia");

    const disabledEmpresas = new Set<string>();
    const customMessages = new Map<string, string>();
    for (const cfg of allConfigs || []) {
      const regras = cfg.regras_bia as any;
      if (regras?.recompra_ativa === false) {
        disabledEmpresas.add(cfg.empresa_id);
      }
      if (regras?.recompra_mensagem_personalizada) {
        customMessages.set(cfg.empresa_id, regras.recompra_mensagem_personalizada);
      }
    }

    // Build unidade -> empresa mapping
    const { data: unidadesList } = await supabase
      .from("unidades").select("id, empresa_id");
    const unidadeEmpresa = new Map<string, string>();
    for (const u of unidadesList || []) {
      if (u.empresa_id) unidadeEmpresa.set(u.id, u.empresa_id);
    }

    // Get delivered orders from last 6 months grouped by client
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: pedidos, error: fetchError } = await supabase
      .from("pedidos")
      .select("cliente_id, created_at, valor_total, unidade_id")
      .eq("status", "entregue")
      .gte("created_at", sixMonthsAgo.toISOString())
      .not("cliente_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(2000);

    if (fetchError) throw fetchError;

    // Group by client and calculate purchase intervals
    const clientMap = new Map<string, {
      datas: Date[];
      ultimaCompra: Date;
      unidade_id: string | null;
    }>();

    for (const p of pedidos || []) {
      if (!p.cliente_id) continue;
      const dt = new Date(p.created_at);
      const existing = clientMap.get(p.cliente_id);
      if (existing) {
        existing.datas.push(dt);
        if (dt > existing.ultimaCompra) {
          existing.ultimaCompra = dt;
          existing.unidade_id = p.unidade_id;
        }
      } else {
        clientMap.set(p.cliente_id, {
          datas: [dt],
          ultimaCompra: dt,
          unidade_id: p.unidade_id,
        });
      }
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Check already sent today
    const { data: sentToday } = await supabase
      .from("recompra_dispatches")
      .select("cliente_id")
      .gte("created_at", today + "T00:00:00")
      .lte("created_at", today + "T23:59:59");

    const alreadySent = new Set((sentToday || []).map((s: any) => s.cliente_id));

    let sent = 0;
    let skipped = 0;

    for (const [clienteId, info] of clientMap) {
      if (info.datas.length < 2) continue; // Need at least 2 purchases
      if (alreadySent.has(clienteId)) { skipped++; continue; }

      // Check if empresa disabled recompra
      const empresaId = info.unidade_id ? unidadeEmpresa.get(info.unidade_id) : null;
      if (empresaId && disabledEmpresas.has(empresaId)) { skipped++; continue; }

      // Calculate average interval
      info.datas.sort((a, b) => a.getTime() - b.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < info.datas.length; i++) {
        intervals.push((info.datas[i].getTime() - info.datas[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      }
      const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const diasSemComprar = (now.getTime() - info.ultimaCompra.getTime()) / (1000 * 60 * 60 * 24);

      // Trigger when client is within 1 day of their cycle OR overdue up to 5 days
      const diff = diasSemComprar - avgInterval;
      if (diff < -1 || diff > 5) continue;

      // Get client phone and name
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("id", clienteId)
        .maybeSingle();

      if (!cliente?.telefone || !cliente?.nome) continue;

      const phone = cliente.telefone.replace(/\D/g, "");
      if (phone.length < 10) continue;

      // 24h cooldown: skip if Bia already sent a message to this phone recently
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentBiaMsg } = await supabase
        .from("ai_mensagens")
        .select("id")
        .eq("role", "assistant")
        .gte("created_at", twentyFourHoursAgo)
        .limit(1);
      // Check by conversation id pattern
      const convIdCheck = `whatsapp_${phone.slice(-10)}`;
      const { count: recentCount } = await supabase
        .from("ai_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("role", "assistant")
        .ilike("conversa_id", `%${phone.slice(-8)}%`)
        .gte("created_at", twentyFourHoursAgo);
      if (recentCount && recentCount > 0) {
        console.log(`Skipping recompra for ${phone}: ${recentCount} msgs in last 24h`);
        skipped++;
        continue;
      }
      if (phone.length < 10) continue;

      // Find the right WhatsApp integration for this client's unidade
      let integration = integracoes.find((i: any) => i.unidade_id === info.unidade_id);
      if (!integration) integration = integracoes.length === 1 ? integracoes[0] : null;
      if (!integration) continue;

      // Check business hours
      if (info.unidade_id) {
        const { data: unidade } = await supabase
          .from("unidades")
          .select("horario_abertura, horario_fechamento")
          .eq("id", info.unidade_id)
          .maybeSingle();

        if (unidade?.horario_abertura) {
          const brasiliaOffset = -3 * 60;
          const localTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
          const currentTime = String(localTime.getHours()).padStart(2, "0") + ":" + String(localTime.getMinutes()).padStart(2, "0");
          if (currentTime < unidade.horario_abertura || currentTime >= (unidade.horario_fechamento || "18:00")) {
            continue; // Don't send outside business hours
          }
        }
      }

      // Build personalized message
      const firstName = cliente.nome.split(" ")[0];
      
      // Check for custom message from empresa config
      const empresaIdForMsg = info.unidade_id ? unidadeEmpresa.get(info.unidade_id) : null;
      const customMsg = empresaIdForMsg ? customMessages.get(empresaIdForMsg) : null;
      
      let message: string;
      if (customMsg) {
        message = customMsg.replace(/\{nome\}/g, firstName);
      } else {
        const messages = [
          `Olá ${firstName} 😊\nEstá precisando de gás hoje?`,
          `Oi ${firstName}! Tudo bem?\nJá está na hora de repor o gás? Posso agendar sua entrega!`,
          `${firstName}, tudo certo? 😊\nVi que já faz um tempinho desde o último pedido. Quer que eu providencie?`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      }

      // Send message according to provider
      let sendResp: Response | null = null;
      
      if (integration.provedor === "evolution") {
        const baseUrl = integration.base_url?.replace(/\/$/, "") || "";
        if (baseUrl) {
          sendResp = await fetch(`${baseUrl}/message/sendText/${integration.instance_id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: integration.token,
            },
            body: JSON.stringify({ number: `55${phone}`, text: message }),
          });
        }
      } else if (integration.provedor === "uazapi") {
        sendResp = await fetch(`https://free.uazapi.com/${integration.instance_id}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${integration.token}` },
          body: JSON.stringify({ to: phone, text: message }),
        });
      } else {
        // Send via Z-API (default fallback)
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (integration.security_token) headers["Client-Token"] = integration.security_token;
  
        sendResp = await fetch(
          `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.token}/send-text`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ phone: `55${phone}`, message }),
          }
        );
      }

      if (sendResp && sendResp.ok) {
        // Log dispatch
        await supabase.from("recompra_dispatches").insert({
          cliente_id: clienteId,
          unidade_id: info.unidade_id,
          mensagem: message,
          telefone: cliente.telefone,
        });
        sent++;
        console.log(`Recompra sent to ${firstName} (${phone})`);
      } else {
        console.error(`Failed to send to ${phone}:`, await sendResp?.text());
      }

      // Rate limit: small delay between sends
      if (sent % 5 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    return new Response(JSON.stringify({ sent, skipped, total_clients: clientMap.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("recompra-whatsapp-dispatch error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
