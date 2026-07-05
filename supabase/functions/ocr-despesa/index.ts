import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const { image_base64, mime_type, filename } = await req.json();
    if (!image_base64) throw new Error("image_base64 obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const prompt = `Você é um OCR fiscal brasileiro. Analise esta despesa/recibo/nota/cupom/boleto e extraia EXATAMENTE estes campos para preencher uma tabela contábil.

Retorne JSON com TODAS estas chaves (use null quando não conseguir ler):
{
  "data": "YYYY-MM-DD",                  // data de emissão (ou vencimento se for boleto)
  "fornecedor": "Razão social ou nome fantasia do estabelecimento",
  "cnpj": "apenas dígitos, sem pontuação",
  "descricao": "Resumo curto e claro: ex 'Combustível Posto Shell' ou 'Conta de energia EDP ref 11/2025'",
  "categoria": "uma destas: Combustível, Alimentação, Materiais, Serviços, Energia, Água, Telefone/Internet, Aluguel, Manutenção, Frete, Impostos, Outros",
  "valor": 0.00,                          // valor TOTAL pago em decimal (use ponto)
  "forma_pagamento": "dinheiro|pix|cartão|boleto|null"
}

REGRAS:
- "valor" SEMPRE numérico decimal (ex: 150.50). Nunca string.
- "cnpj" só dígitos (ex: "12345678000199") ou null.
- "data" sempre formato ISO YYYY-MM-DD.
- "fornecedor" é o nome do EMITENTE (quem vendeu/prestou).
- Responda APENAS o JSON puro, sem markdown, sem comentários.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime_type || "image/jpeg"};base64,${image_base64}` } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("Limite de uso atingido — aguarde");
      if (response.status === 402) throw new Error("Sem créditos no Lovable AI");
      throw new Error(`Gateway error ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(cleaned); } catch { parsed = { descricao: filename, raw: cleaned }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-despesa:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
