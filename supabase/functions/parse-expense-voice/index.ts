import "https://esm.sh/xhr2@0.2.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text } = await req.json();

    if (!text || text.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Texto muito curto" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const today = new Date().toISOString().split("T")[0];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que interpreta comandos de voz em português brasileiro para registrar despesas/contas a pagar.

A data de hoje é ${today}.

Extraia as informações do texto e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto extra) com esta estrutura:
{
  "despesas": [
    {
      "fornecedor": "string (nome da empresa/prestador)",
      "descricao": "string (descrição clara da despesa)",
      "valor": number (valor em decimal, ex: 350.90),
      "vencimento": "YYYY-MM-DD (data de vencimento, se não mencionada use 7 dias a partir de hoje)",
      "categoria": "string (uma das categorias: Fornecedores, Frota, Infraestrutura, Utilidades, RH, Compras, Outros)",
      "observacoes": "string ou null"
    }
  ]
}

Regras:
- Se o usuário mencionar múltiplas despesas, retorne todas no array.
- Interprete valores monetários falados como "duzentos reais" = 200, "mil e quinhentos" = 1500, "trezentos e cinquenta e dois e noventa" = 352.90.
- Classifique a categoria automaticamente.
- Se a data de vencimento não for mencionada, use 7 dias a partir de hoje.
- Se o fornecedor não for claro, use "A definir".
- Seja flexível com erros de transcrição de voz.`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Não foi possível interpretar o comando de voz" }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
