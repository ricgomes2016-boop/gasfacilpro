import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { imageBase64, text, mode } = await req.json();

    if (!imageBase64 && !text) {
      return new Response(JSON.stringify({ error: "Imagem ou texto não fornecido" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Load clients and products for matching
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [{ data: clientes }, { data: produtos }] = await Promise.all([
      sb.from("clientes").select("id, nome, telefone, endereco, bairro").eq("ativo", true).limit(300),
      sb.from("produtos").select("id, nome, preco, categoria").eq("ativo", true).or("tipo_botijao.is.null,tipo_botijao.neq.vazio").limit(100),
    ]);

    const clientesList = (clientes || []).map((c: any) => `- "${c.nome}" (id: ${c.id})`).join("\n");
    const produtosList = (produtos || []).map((p: any) => `- "${p.nome}" R$${p.preco} (id: ${p.id})`).join("\n");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `Você é um assistente especializado em importar histórico de vendas/pedidos de distribuidoras de gás.

A data de hoje é ${today}.

CLIENTES CADASTRADOS:
${clientesList}

PRODUTOS DISPONÍVEIS:
${produtosList}

Extraia TODOS os pedidos/vendas encontrados e retorne EXCLUSIVAMENTE um JSON válido:
{
  "pedidos": [
    {
      "cliente_id": "uuid ou null (se encontrar no cadastro acima)",
      "cliente_nome": "string (nome do cliente como aparece no documento)",
      "data": "YYYY-MM-DD (data ORIGINAL do pedido - MUITO IMPORTANTE respeitar a data do documento)",
      "itens": [
        {
          "produto_id": "uuid ou null",
          "nome": "string",
          "quantidade": number,
          "preco_unitario": number
        }
      ],
      "valor_total": number,
      "forma_pagamento": "dinheiro|pix|cartao_credito|cartao_debito|fiado|null",
      "status": "entregue",
      "endereco": "string ou null",
      "observacoes": "string ou null"
    }
  ]
}

REGRAS CRÍTICAS:
1. RESPEITE as datas originais do documento! Se diz "05/01/2025", retorne "2025-01-05". Não use a data de hoje.
2. Identifique CADA pedido/venda separadamente.
3. Para cada venda, tente associar ao cliente_id e produto_id dos cadastros acima (busca parcial, case insensitive).
4. Se o produto não existir no cadastro, retorne produto_id null mas inclua nome e preço.
5. Todos os pedidos importados devem ter status "entregue" pois são históricos.
6. Se "gás" sem especificar, assuma P13. Se "água" sem especificar, assuma galão 20L.
7. Interprete valores monetários brasileiros: "R$ 110,00" = 110, "R$ 1.500,00" = 1500.`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (mode === "voice" && text) {
      messages.push({ role: "user", content: text });
    } else if (imageBase64) {
      const imageContent = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extraia TODOS os pedidos/vendas deste documento histórico. RESPEITE as datas originais:" },
          { type: "image_url", image_url: { url: imageContent } },
        ],
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      console.error("Failed to parse:", content);
      return new Response(JSON.stringify({ error: "Não foi possível interpretar os dados" }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
