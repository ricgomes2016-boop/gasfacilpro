import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { pdf_base64, filename } = await req.json();
    if (!pdf_base64) throw new Error("pdf_base64 obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const prompt = `Este é um extrato bancário em PDF. Extraia TODAS as transações em JSON.
Formato de resposta:
{ "transacoes": [ { "data": "YYYY-MM-DD", "descricao": "...", "valor": -123.45 }, ... ] }
Valores negativos = débito, positivos = crédito. Responda APENAS o JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf_base64}` } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("Limite de uso atingido");
      if (response.status === 402) throw new Error("Sem créditos no Lovable AI");
      throw new Error(`Gateway error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed: any = { transacoes: [] };
    try { parsed = JSON.parse(cleaned); } catch (e) { console.warn("parse error:", e, cleaned.slice(0, 200)); }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-extrato-pdf:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
