// Edge function: sugerir-escala-ia
// Gera proposta de escala semanal usando histórico + IA (Lovable AI Gateway)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const { unidade_id, inicio_semana } = await req.json();
    if (!inicio_semana) {
      return new Response(JSON.stringify({ error: "inicio_semana é obrigatório (YYYY-MM-DD, segunda-feira)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!unidade_id) {
      return new Response(JSON.stringify({ error: "unidade_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Tenant guard: caller must belong to the unidade's empresa (unless service role)
    if (!auth.isServiceRole) {
      const { data: prof } = await supabase
        .from("profiles").select("empresa_id").eq("user_id", auth.userId).maybeSingle();
      const { data: uni } = await supabase
        .from("unidades").select("empresa_id").eq("id", unidade_id).maybeSingle();
      if (!prof?.empresa_id || !uni?.empresa_id || prof.empresa_id !== uni.empresa_id) {
        return new Response(JSON.stringify({ error: "Acesso negado a esta unidade" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Datas: semana visível e 4 semanas anteriores
    const inicio = new Date(inicio_semana + "T00:00:00");
    const semanaDias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio); d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const histInicio = new Date(inicio); histInicio.setDate(histInicio.getDate() - 28);
    const histInicioStr = histInicio.toISOString().slice(0, 10);
    const histFim = new Date(inicio); histFim.setDate(histFim.getDate() - 1);
    const histFimStr = histFim.toISOString().slice(0, 10);

    // Buscar dados em paralelo (sempre filtrados pela unidade validada)
    const entregadoresQ = supabase.from("entregadores").select("id, nome").eq("ativo", true).eq("unidade_id", unidade_id);
    const rotasQ = supabase.from("rotas_definidas").select("id, nome").eq("ativo", true).eq("unidade_id", unidade_id);
    const histQ = supabase.from("escalas_entregador")
      .select("entregador_id, data, turno_inicio, turno_fim, almoco_inicio, almoco_fim, rota_definida_id")
      .gte("data", histInicioStr).lte("data", histFimStr).eq("unidade_id", unidade_id);
    const pedidosQ = supabase.from("pedidos")
      .select("created_at")
      .gte("created_at", histInicioStr).lte("created_at", histFimStr + "T23:59:59")
      .eq("unidade_id", unidade_id)
      .limit(2000);

    const [entRes, rotasRes, histRes, pedidosRes] = await Promise.all([entregadoresQ, rotasQ, histQ, pedidosQ]);

    const entregadores = entRes.data || [];
    const rotas = rotasRes.data || [];
    const historico = histRes.data || [];
    const pedidos = pedidosRes.data || [];

    if (entregadores.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum entregador ativo nesta unidade" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Demanda: pedidos por (dia da semana × hora)
    const demanda: Record<string, number> = {};
    for (const p of pedidos) {
      const dt = new Date(p.created_at);
      const dow = dt.getUTCDay(); // 0=dom..6=sab
      const hr = dt.getUTCHours();
      const k = `${dow}-${hr}`;
      demanda[k] = (demanda[k] || 0) + 1;
    }

    // Padrão por entregador (turno mais comum)
    const padraoEntregador: Record<string, { turno_inicio: string; turno_fim: string; almoco_inicio: string | null; almoco_fim: string | null; folgas_dow: number[] }> = {};
    for (const e of entregadores) {
      const meus = historico.filter((h) => h.entregador_id === e.id);
      const conta: Record<string, number> = {};
      const diasTrabalhados = new Set<number>();
      for (const m of meus) {
        const k = `${m.turno_inicio}|${m.turno_fim}|${m.almoco_inicio || ""}|${m.almoco_fim || ""}`;
        conta[k] = (conta[k] || 0) + 1;
        diasTrabalhados.add(new Date(m.data + "T00:00:00").getUTCDay());
      }
      let melhor = "08:00:00|18:00:00|12:00:00|13:00:00";
      let max = 0;
      for (const [k, v] of Object.entries(conta)) {
        if (v > max) { max = v; melhor = k; }
      }
      const [ti, tf, ai, af] = melhor.split("|");
      const todosDow = [0, 1, 2, 3, 4, 5, 6];
      const folgas = todosDow.filter((d) => !diasTrabalhados.has(d));
      padraoEntregador[e.id] = {
        turno_inicio: ti.slice(0, 5),
        turno_fim: tf.slice(0, 5),
        almoco_inicio: ai ? ai.slice(0, 5) : null,
        almoco_fim: af ? af.slice(0, 5) : null,
        folgas_dow: folgas,
      };
    }

    const contexto = {
      semana_alvo: semanaDias,
      entregadores: entregadores.map((e) => ({
        id: e.id, nome: e.nome,
        padrao: padraoEntregador[e.id],
      })),
      rotas: rotas.map((r) => ({ id: r.id, nome: r.nome })),
      demanda_por_hora: demanda,
      total_pedidos_4sem: pedidos.length,
    };

    const systemPrompt = `Você é um assistente de RH especializado em escalas de entregadores de gás/água.
Gere uma proposta de escala semanal otimizada com base no contexto fornecido.

Regras OBRIGATÓRIAS:
1. Cada entregador trabalha 5 ou 6 dias na semana (1 ou 2 folgas).
2. Respeite o padrão histórico de turno e almoço de cada entregador quando possível.
3. Distribua as rotas de forma equilibrada entre os entregadores.
4. Cubra os horários de pico (analise demanda_por_hora — chave "dow-hora").
5. Use formato de hora "HH:MM" (24h).
6. Datas devem ser exatamente as do array semana_alvo (formato YYYY-MM-DD).
7. Almoço é opcional (null permitido) mas recomendado para turnos > 6h.

Retorne APENAS a estrutura via tool call.`;

    const userPrompt = `Contexto:\n${JSON.stringify(contexto, null, 2)}\n\nGere a escala da semana.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "propor_escala",
            description: "Retorna proposta de escala semanal",
            parameters: {
              type: "object",
              properties: {
                escalas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entregador_id: { type: "string" },
                      data: { type: "string", description: "YYYY-MM-DD" },
                      turno_inicio: { type: "string", description: "HH:MM" },
                      turno_fim: { type: "string", description: "HH:MM" },
                      almoco_inicio: { type: ["string", "null"], description: "HH:MM ou null" },
                      almoco_fim: { type: ["string", "null"], description: "HH:MM ou null" },
                      rota_definida_id: { type: ["string", "null"] },
                    },
                    required: ["entregador_id", "data", "turno_inicio", "turno_fim"],
                    additionalProperties: false,
                  },
                },
                resumo: { type: "string", description: "Breve explicação da estratégia" },
              },
              required: ["escalas", "resumo"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "propor_escala" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao chamar IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou proposta válida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const proposta = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(proposta), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sugerir-escala-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
