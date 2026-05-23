import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const { unidade_id } = await req.json();

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all orders from last 6 months, grouped by client
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let query = sb
      .from("pedidos")
      .select("cliente_id, created_at, valor_total, clientes(nome, telefone)")
      .eq("status", "entregue")
      .gte("created_at", sixMonthsAgo.toISOString())
      .not("cliente_id", "is", null)
      .order("created_at", { ascending: true });

    if (unidade_id) {
      query = query.eq("unidade_id", unidade_id);
    }

    const { data: pedidos, error } = await query.limit(2000);
    if (error) throw error;

    // Group by client and calculate purchase intervals
    const clientMap = new Map<string, {
      nome: string;
      telefone: string | null;
      datas: Date[];
      ultimaCompra: Date;
      valorMedio: number;
      totalCompras: number;
    }>();

    for (const p of pedidos || []) {
      if (!p.cliente_id) continue;
      const existing = clientMap.get(p.cliente_id);
      const dt = new Date(p.created_at);
      if (existing) {
        existing.datas.push(dt);
        if (dt > existing.ultimaCompra) existing.ultimaCompra = dt;
        existing.totalCompras += p.valor_total || 0;
      } else {
        clientMap.set(p.cliente_id, {
          nome: (p.clientes as any)?.nome || "Desconhecido",
          telefone: (p.clientes as any)?.telefone || null,
          datas: [dt],
          ultimaCompra: dt,
          valorMedio: 0,
          totalCompras: p.valor_total || 0,
        });
      }
    }

    const now = new Date();
    const alerts: Array<{
      cliente_id: string;
      cliente_nome: string;
      telefone: string | null;
      dias_sem_comprar: number;
      intervalo_medio_dias: number;
      atraso_dias: number;
      previsao_recompra: string;
      valor_medio: number;
      prioridade: "alta" | "media" | "baixa";
    }> = [];

    for (const [clienteId, info] of clientMap) {
      if (info.datas.length < 2) continue; // Need at least 2 purchases to calculate pattern

      // Sort dates and calculate average interval
      info.datas.sort((a, b) => a.getTime() - b.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < info.datas.length; i++) {
        const diffDays = (info.datas[i].getTime() - info.datas[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(diffDays);
      }
      const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const diasSemComprar = (now.getTime() - info.ultimaCompra.getTime()) / (1000 * 60 * 60 * 24);
      const atrasoDias = diasSemComprar - avgInterval;

      // Only alert if client is overdue or about to be due (within 3 days)
      if (atrasoDias >= -3) {
        const previsao = new Date(info.ultimaCompra.getTime() + avgInterval * 24 * 60 * 60 * 1000);
        alerts.push({
          cliente_id: clienteId,
          cliente_nome: info.nome,
          telefone: info.telefone,
          dias_sem_comprar: Math.round(diasSemComprar),
          intervalo_medio_dias: Math.round(avgInterval),
          atraso_dias: Math.round(atrasoDias),
          previsao_recompra: previsao.toISOString().split("T")[0],
          valor_medio: Math.round((info.totalCompras / info.datas.length) * 100) / 100,
          prioridade: atrasoDias > 10 ? "alta" : atrasoDias > 3 ? "media" : "baixa",
        });
      }
    }

    // Sort by priority (alta first), then by atraso_dias desc
    const prioridadeOrdem = { alta: 0, media: 1, baixa: 2 };
    alerts.sort((a, b) => prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade] || b.atraso_dias - a.atraso_dias);

    return new Response(JSON.stringify({ alerts: alerts.slice(0, 50) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
