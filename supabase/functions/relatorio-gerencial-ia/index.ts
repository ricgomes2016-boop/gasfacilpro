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

    const { unidade_id, periodo } = await req.json().catch(() => ({ unidade_id: null, periodo: "mensal" }));

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
    const clienteFilter = `AND empresa_id = '${empresaId}'`;
    const intervalo = periodo === "semanal" ? "7 days" : "30 days";

    const queries = [
      // Faturamento e vendas
      `SELECT COUNT(*) as total_pedidos,
        COALESCE(SUM(valor_total), 0) as faturamento,
        COALESCE(AVG(valor_total), 0) as ticket_medio,
        COUNT(CASE WHEN status = 'cancelado' THEN 1 END) as cancelados
       FROM pedidos WHERE created_at >= NOW() - interval '${intervalo}' ${unidadeFilter}`,
      // Despesas consolidadas: contas_pagar (pagas), movimentacoes_caixa (saidas sem compra) e despesas_contabeis
      `SELECT categoria, SUM(valor) AS total_despesas, COUNT(*) AS qtd
       FROM (
         SELECT COALESCE(categoria,'Sem categoria') AS categoria, valor
         FROM contas_pagar
         WHERE status = 'paga'
           AND data_pagamento >= (NOW() - interval '${intervalo}')::date ${unidadeFilter}
         UNION ALL
         SELECT COALESCE(categoria,'Caixa/Sangria') AS categoria, valor
         FROM movimentacoes_caixa
         WHERE tipo = 'saida' AND compra_id IS NULL
           AND created_at >= NOW() - interval '${intervalo}' ${unidadeFilter}
         UNION ALL
         SELECT COALESCE(categoria,'Contábil') AS categoria, valor
         FROM despesas_contabeis
         WHERE data_despesa >= (NOW() - interval '${intervalo}')::date ${unidadeFilter}
       ) t
       GROUP BY categoria ORDER BY total_despesas DESC`,
      // Top produtos
      `SELECT pi.produto_nome, SUM(pi.quantidade) as qtd, SUM(pi.subtotal) as receita
       FROM pedido_itens pi JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.status != 'cancelado' ${pedidoAliasFilter}
        AND p.created_at >= NOW() - interval '${intervalo}'
       GROUP BY pi.produto_nome ORDER BY receita DESC LIMIT 10`,
      // Formas de pagamento - por valor total, apenas concluídas
      `SELECT forma_pagamento, COUNT(*) as qtd, COALESCE(SUM(valor_total), 0) as total
       FROM pedidos WHERE status IN ('entregue','concluido','finalizado') ${unidadeFilter}
        AND created_at >= NOW() - interval '${intervalo}'
       GROUP BY forma_pagamento ORDER BY total DESC`,

      // Produtividade entregadores
      `SELECT e.nome, COUNT(p.id) as entregas, COALESCE(SUM(p.valor_total), 0) as faturamento
       FROM entregadores e LEFT JOIN pedidos p ON p.entregador_id = e.id
        AND p.status IN ('entregue','concluido','finalizado') AND p.created_at >= NOW() - interval '${intervalo}'
       WHERE e.ativo = true ${entregadorAliasFilter} GROUP BY e.id, e.nome ORDER BY entregas DESC LIMIT 10`,
      // Novos clientes
      `SELECT COUNT(*) as novos_clientes FROM clientes
       WHERE created_at >= NOW() - interval '${intervalo}' ${clienteFilter}`,
      // Estoque crítico
      `SELECT nome, estoque, estoque_minimo_calculado AS estoque_minimo FROM vw_previsao_ruptura
       WHERE situacao IN ('critico','sem_estoque') ${unidadeFilter}`,
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

    const [vendas, despesas, topProdutos, pagamentos, entregadores, novosClientes, estoqueCritico] = results;

    const contextData = JSON.stringify({
      periodo,
      vendas, despesas, top_produtos: topProdutos,
      formas_pagamento: pagamentos, entregadores,
      novos_clientes: novosClientes, estoque_critico: estoqueCritico,
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
            content: `Você é um diretor financeiro de uma distribuidora de gás escrevendo um relatório gerencial ${periodo === "semanal" ? "semanal" : "mensal"}.

Gere um relatório estruturado com as seguintes seções:
1. RESUMO EXECUTIVO (3-4 frases com os principais números)
2. ANÁLISE DE VENDAS (tendências, ticket médio, cancelamentos)
3. ANÁLISE FINANCEIRA (receita vs despesas, margem, formas de pagamento)
4. PRODUTIVIDADE OPERACIONAL (entregadores, eficiência)
5. ESTOQUE E SUPRIMENTOS (alertas, reposições necessárias)
6. RECOMENDAÇÕES (3-5 ações prioritárias para o próximo período)

Use linguagem profissional, números específicos, e formate com markdown.
Inclua emojis relevantes nos títulos das seções.`,
          },
          { role: "user", content: `Dados do período:\n${contextData}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit atingido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ relatorio: content, dados: { vendas, despesas, topProdutos, entregadores } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("relatorio-gerencial-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
