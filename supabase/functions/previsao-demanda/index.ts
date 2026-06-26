import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { unidade_id } = await req.json().catch(() => ({ unidade_id: null }));

    // Validate unidade_id as UUID to prevent SQL injection
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (unidade_id !== null && unidade_id !== undefined && !UUID_RE.test(String(unidade_id))) {
      return new Response(JSON.stringify({ error: "unidade_id inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Verify caller and tenant ownership of unidade_id
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("user_id", userData.user.id).single();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (unidade_id) {
      const { data: u } = await supabase.from("unidades").select("id").eq("id", unidade_id).eq("empresa_id", empresaId).maybeSingle();
      if (!u) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const unidadeFilter = unidade_id
      ? `AND unidade_id = '${unidade_id}'`
      : `AND unidade_id IN (SELECT id FROM unidades WHERE empresa_id = '${empresaId}')`;
    const pedidoAliasFilter = unidade_id
      ? `AND p.unidade_id = '${unidade_id}'`
      : `AND p.unidade_id IN (SELECT id FROM unidades WHERE empresa_id = '${empresaId}')`;
    const entregadorAliasFilter = unidade_id
      ? `AND e.unidade_id = '${unidade_id}'`
      : `AND e.unidade_id IN (SELECT id FROM unidades WHERE empresa_id = '${empresaId}')`;

    const queries = [
      // Vendas por dia da semana (últimas 8 semanas)
      `SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'America/Sao_Paulo') as dow,
        COUNT(*) as qtd, COALESCE(SUM(valor_total), 0) as total
       FROM pedidos WHERE status != 'cancelado' ${unidadeFilter}
        AND created_at >= NOW() - interval '8 weeks'
       GROUP BY dow ORDER BY dow`,
      // Top produtos vendidos (últimos 30 dias)
      `SELECT pi.produto_nome, SUM(pi.quantidade) as qtd
       FROM pedido_itens pi JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.status != 'cancelado' ${pedidoAliasFilter}
        AND p.created_at >= NOW() - interval '30 days'
       GROUP BY pi.produto_nome ORDER BY qtd DESC LIMIT 10`,
      // Estoque atual dos top produtos
      `SELECT nome, estoque, estoque_minimo FROM produtos
       WHERE ativo = true ${unidadeFilter} ORDER BY estoque ASC LIMIT 15`,
      // Entregadores ativos e média de entregas/dia
      `SELECT e.nome, COUNT(p.id) as total_entregas,
        COUNT(DISTINCT p.created_at::date) as dias_ativos
       FROM entregadores e LEFT JOIN pedidos p ON p.entregador_id = e.id
        AND p.status = 'entregue' AND p.created_at >= NOW() - interval '30 days'
       WHERE e.ativo = true ${entregadorAliasFilter}
       GROUP BY e.id, e.nome ORDER BY total_entregas DESC LIMIT 10`,
      // Tendência semanal (últimas 4 semanas)
      `SELECT date_trunc('week', created_at AT TIME ZONE 'America/Sao_Paulo')::date as semana,
        COUNT(*) as pedidos, COALESCE(SUM(valor_total), 0) as faturamento
       FROM pedidos WHERE status != 'cancelado' ${unidadeFilter}
        AND created_at >= NOW() - interval '4 weeks'
       GROUP BY semana ORDER BY semana`,
    ];

    const results = await Promise.all(
      queries.map(async (sql) => {
        try {
          const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: sql });
          if (error) return null;
          return data;
        } catch { return null; }
      })
    );

    const [vendasPorDia, topProdutos, estoqueAtual, entregadores, tendenciaSemanal] = results;

    const now = new Date();
    const dayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const proximosDias = [1, 2, 3].map(d => {
      const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      return dayNames[date.getDay()];
    });

    const contextData = JSON.stringify({
      vendas_por_dia_semana: vendasPorDia,
      top_produtos_30d: topProdutos,
      estoque_atual: estoqueAtual,
      entregadores_produtividade: entregadores,
      tendencia_semanal: tendenciaSemanal,
      proximos_dias: proximosDias,
      dia_atual: dayNames[now.getDay()],
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista de demanda de uma distribuidora de gás. Com base no histórico de vendas, estoque e produtividade dos entregadores, gere previsões para os próximos dias.

Regras:
- Gere EXATAMENTE 4-5 previsões acionáveis
- Inclua: sugestão de estoque ideal, número de entregadores necessários, e tendências
- Use dados numéricos específicos nas previsões
- Cada previsão tem no máximo 2 frases
- Comece com emoji relevante
- Priorize ações preventivas (ex: reabastecer antes de acabar)`,
          },
          { role: "user", content: `Dados históricos:\n${contextData}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_previsoes",
            description: "Retorna as previsões de demanda",
            parameters: {
              type: "object",
              properties: {
                previsoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      emoji: { type: "string" },
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      tipo: { type: "string", enum: ["estoque", "logistica", "vendas"] },
                    },
                    required: ["emoji", "titulo", "descricao", "tipo"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["previsoes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_previsoes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit atingido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ previsoes: parsed.previsoes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ previsoes: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("previsao-demanda error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
