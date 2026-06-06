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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    // Require authenticated admin/gestor (business metrics)
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let empresaId: string | null = null;
    let unidadeId: string | null = null;
    let cidadeUnidade = "";
    let estadoUnidade = "";

    if (!auth.isServiceRole && auth.userId) {
      // Check role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.userId);
      const allowed = (roles || []).some((r: any) =>
        ["admin", "gestor", "super_admin"].includes(r.role)
      );
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", auth.userId)
        .single();
      empresaId = profile?.empresa_id || null;
    }

    const body = await req.json();
    unidadeId = body.unidade_id || null;
    
    // Fetch unidade info for regional context
    if (unidadeId) {
      const { data: unidade } = await supabase
        .from("unidades")
        .select("cidade, estado, nome")
        .eq("id", unidadeId)
        .single();
      cidadeUnidade = unidade?.cidade || "";
      estadoUnidade = unidade?.estado || "";
    }

    // Fetch real data for proactive suggestions
    let contextData = "";

    if (empresaId) {
      // Recent sales count
      const { count: vendasRecentes } = await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

      // Low stock products
      const { data: estoqueBaixo } = await supabase
        .from("produtos")
        .select("nome, estoque")
        .eq("unidade_id", unidadeId || "")
        .lt("estoque", 10)
        .limit(5);

      // Top selling products
      const { data: topProdutos } = await supabase
        .from("pedido_itens")
        .select("produto_nome, quantidade")
        .limit(5);

      contextData = `
Dados reais do negócio:
- Vendas nos últimos 7 dias: ${vendasRecentes || 0}
- Cidade: ${cidadeUnidade || "não informada"}, Estado: ${estadoUnidade || ""}
- Produtos com estoque baixo: ${estoqueBaixo?.map(p => `${p.nome} (${p.estoque} un)`).join(", ") || "nenhum"}
- Data atual: ${new Date().toLocaleDateString("pt-BR")}
- Mês atual: ${new Date().toLocaleDateString("pt-BR", { month: "long" })}
`;
    }

    const systemPrompt = `Você é um agente de marketing inteligente para revendas de gás GLP.
Seu trabalho é gerar sugestões PROATIVAS de marketing baseadas em dados reais do negócio.

${contextData}

Responda em JSON com a seguinte estrutura:
{
  "sugestoes": [
    {
      "titulo": "título curto da sugestão",
      "descricao": "descrição detalhada com ação sugerida",
      "prioridade": "alta|media|baixa",
      "tipo": "post|campanha|video|promocao|data_comemorativa",
      "plataforma_ideal": "instagram|facebook|tiktok|whatsapp",
      "texto_sugerido": "texto pronto para publicar (se aplicável)"
    }
  ]
}

Gere de 3 a 5 sugestões relevantes baseadas em:
1. Datas comemorativas próximas (brasileiras)
2. Sazonalidade (inverno = mais consumo de gás)
3. Estoque baixo (oportunidade de comunicar promoção antes de acabar)
4. Região/cidade da unidade
5. Volume de vendas recente (se baixo, sugerir promoções)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Gere sugestões proativas de marketing para minha revenda de gás agora." },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("marketing-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
