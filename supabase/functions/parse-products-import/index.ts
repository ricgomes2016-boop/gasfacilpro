import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const { imageBase64, text, mode } = await req.json();

    if (!imageBase64 && !text) {
      return new Response(JSON.stringify({ error: "Imagem ou texto não fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um assistente especializado em extrair dados de produtos de distribuidoras de gás, água e acessórios.

Extraia TODOS os produtos encontrados e retorne EXCLUSIVAMENTE um JSON válido com esta estrutura:
{
  "produtos": [
    {
      "nome": "string (nome do produto, ex: P13 Cheio, Água 20L, Mangueira 1,5m)",
      "categoria": "string (gas, agua, acessorio ou outro)",
      "preco": number (preço de venda em decimal, ex: 110.00),
      "estoque": number (quantidade em estoque se mencionada, senão 0),
      "codigo_barras": "string ou null",
      "descricao": "string ou null (descrição adicional)",
      "tipo_botijao": "string (cheio, vazio ou null - apenas para gás/água)"
    }
  ]
}

Regras:
- Se houver múltiplos produtos, retorne todos no array.
- Para botijões de gás (P2, P5, P13, P20, P45), classifique como "gas" e tipo_botijao "cheio".
- Para galões de água, classifique como "agua" e tipo_botijao "cheio".
- Para mangueiras, reguladores, válvulas, etc., classifique como "acessorio" e tipo_botijao null.
- Valores monetários em número decimal (ex: 150.50).
- Se não conseguir ler algum campo, use null.
- Interprete valores falados como "cento e dez" = 110.`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (mode === "voice" && text) {
      messages.push({ role: "user", content: text });
    } else if (imageBase64) {
      const imageContent = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extraia todos os produtos desta imagem/documento:" },
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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
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
