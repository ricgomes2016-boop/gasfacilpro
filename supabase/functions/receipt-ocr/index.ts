import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que analisa fotos de recibos, cupons fiscais e notas de despesa.
Extraia as informações e retorne usando a função extract_expense.
Para o campo "tipo", use uma dessas opções: combustivel, manutencao, alimentacao, salario, pedagio, outros.
Se não conseguir identificar algum campo, deixe como null.
Para a data, use formato YYYY-MM-DD. Se não houver data visível, use null.
Para o valor, extraia o valor total em reais (número decimal).`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise esta foto de despesa e extraia: tipo, descrição, valor e data." },
              { type: "image_url", image_url: { url: image_base64 } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_expense",
              description: "Extrair dados de uma despesa a partir de uma foto de recibo/cupom",
              parameters: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["combustivel", "manutencao", "alimentacao", "salario", "pedagio", "outros"], description: "Categoria da despesa" },
                  descricao: { type: "string", nullable: true, description: "Descrição resumida da despesa" },
                  valor: { type: "number", nullable: true, description: "Valor total em reais" },
                  data: { type: "string", nullable: true, description: "Data no formato YYYY-MM-DD" },
                },
                required: ["tipo"],
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_expense" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erro ao analisar imagem");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair dados da imagem" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("receipt-ocr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
