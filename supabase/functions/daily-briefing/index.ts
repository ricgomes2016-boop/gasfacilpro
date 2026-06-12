import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { unidade_id, user_name } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user's empresa_id from their profile
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Get empresa_id from profile
    const { data: profile } = await sb
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .single();

    const empresaId = profile?.empresa_id;

    if (!empresaId) {
      return new Response(JSON.stringify({ briefing: "Nenhuma empresa vinculada ao seu perfil.", context: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unidade IDs belonging to this empresa for filtering
    const { data: unidades } = await sb
      .from("unidades")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("ativo", true);
    const unidadeIds = (unidades || []).map((u: any) => u.id);

    if (unidadeIds.length === 0) {
      return new Response(JSON.stringify({ briefing: "Nenhuma unidade ativa encontrada.", context: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Brasília timezone (UTC-3)
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const today = nowBrasilia.toISOString().split("T")[0];

    // Validate that the provided unidade_id belongs to this empresa
    const safeUnidadeId = unidade_id && unidadeIds.includes(unidade_id) ? unidade_id : null;

    // Build filtered queries
    const buildPedidosHoje = () => {
      let q = sb.from("pedidos").select("id, valor_total, status").gte("created_at", `${today}T00:00:00`);
      if (safeUnidadeId) q = q.eq("unidade_id", safeUnidadeId);
      else q = q.in("unidade_id", unidadeIds);
      return q;
    };

    const buildEstoqueBaixo = () => {
      let q = sb.from("produtos").select("id, nome, estoque").lte("estoque", 5);
      if (safeUnidadeId) q = q.eq("unidade_id", safeUnidadeId);
      else q = q.in("unidade_id", unidadeIds);
      return q;
    };

    const buildManutencoes = () => {
      let q = sb.from("manutencoes").select("id, veiculo_id, tipo, descricao, veiculos(placa)").eq("status", "pendente").limit(5);
      if (safeUnidadeId) q = q.eq("unidade_id", safeUnidadeId);
      else q = q.in("unidade_id", unidadeIds);
      return q;
    };

    const buildContasPagar = () => {
      let q = sb.from("contas_pagar").select("id, descricao, valor, vencimento").eq("status", "pendente").lte("vencimento", today).limit(5);
      if (safeUnidadeId) q = q.eq("unidade_id", safeUnidadeId);
      else q = q.in("unidade_id", unidadeIds);
      return q;
    };

    const buildAlertasJornada = () => {
      let q = sb.from("alertas_jornada").select("id, tipo, descricao, funcionarios(nome)").eq("resolvido", false).limit(5);
      if (safeUnidadeId) q = q.eq("unidade_id", safeUnidadeId);
      else q = q.in("unidade_id", unidadeIds);
      return q;
    };

    const buildPedidosPendentes = () => {
      let q = sb.from("pedidos").select("id").in("status", ["pendente", "em_preparo"]);
      if (safeUnidadeId) q = q.eq("unidade_id", safeUnidadeId);
      else q = q.in("unidade_id", unidadeIds);
      return q;
    };

    // Gather data in parallel
    const [
      { data: pedidosHoje },
      { data: estoqueBaixo },
      { data: manutencoesPendentes },
      { data: contasPagar },
      { data: alertasJornada },
      { data: pedidosPendentes },
    ] = await Promise.all([
      buildPedidosHoje(),
      buildEstoqueBaixo(),
      buildManutencoes(),
      buildContasPagar(),
      buildAlertasJornada(),
      buildPedidosPendentes(),
    ]);

    const totalVendasHoje = (pedidosHoje || [])
      .filter((p: any) => p.status !== "cancelado")
      .reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);

    const context = {
      nome_gestor: user_name || "Gestor",
      hora: nowBrasilia.getHours(),
      vendas_hoje: { total: pedidosHoje?.length || 0, valor: totalVendasHoje },
      pedidos_pendentes: pedidosPendentes?.length || 0,
      estoque_baixo: (estoqueBaixo || []).map((p: any) => ({ nome: p.nome, atual: p.estoque, minimo: 5 })),
      manutencoes: (manutencoesPendentes || []).map((m: any) => ({ placa: (m.veiculos as any)?.placa, tipo: m.tipo, descricao: m.descricao })),
      contas_vencidas: (contasPagar || []).map((c: any) => ({ descricao: c.descricao, valor: c.valor, vencimento: c.vencimento })),
      alertas_jornada: (alertasJornada || []).map((a: any) => ({ funcionario: (a.funcionarios as any)?.nome, tipo: a.tipo, descricao: a.descricao })),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const saudacao = context.hora < 12 ? "Bom dia" : context.hora < 18 ? "Boa tarde" : "Boa noite";

    if (!LOVABLE_API_KEY) {
      const briefing = `${saudacao}, ${context.nome_gestor}! 👋\n\n` +
        `• Vendas hoje: ${context.vendas_hoje.total} pedido(s), R$ ${context.vendas_hoje.valor.toFixed(2)}.\n` +
        `• Pedidos pendentes: ${context.pedidos_pendentes}.\n` +
        `• Produtos com estoque baixo: ${context.estoque_baixo.length}.\n\n` +
        `Dados carregados. A geração com IA fica disponível após configurar a chave do gateway.`;

      return new Response(JSON.stringify({ briefing, context, ai_unavailable: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é o assistente de gestão de uma revenda de gás. Gere um briefing matinal curto e direto para o gestor.
Use emojis para deixar visual. Seja conciso (máx 200 palavras). Use markdown com bullet points.
Comece com: "${saudacao}, ${context.nome_gestor}! 👋"
Depois resuma os pontos mais importantes do dia baseado nos dados.
Se não houver alertas em alguma categoria, não mencione. Foque apenas no que existe.
Termine com uma frase motivacional curta.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados do dia:\n${JSON.stringify(context, null, 2)}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.warn("AI gateway unavailable:", aiRes.status, errText);
      const briefing = `${saudacao}, ${context.nome_gestor}! 👋\n\n` +
        `• Vendas hoje: ${context.vendas_hoje.total} pedido(s), R$ ${context.vendas_hoje.valor.toFixed(2)}.\n` +
        `• Pedidos pendentes: ${context.pedidos_pendentes}.\n` +
        `• Produtos com estoque baixo: ${context.estoque_baixo.length}.\n\n` +
        `Dados carregados. A IA não respondeu agora, mas o resumo operacional segue disponível.`;

      return new Response(JSON.stringify({ briefing, context, ai_unavailable: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const briefing = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o briefing.";

    return new Response(JSON.stringify({ briefing, context }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-briefing error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
